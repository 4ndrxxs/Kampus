import { Box, Text, render, useApp, useInput, useStdin } from 'ink';
import { useEffect, useMemo, useState } from 'react';
import { KAMPUS_TAGLINE } from './logo.js';
import { Callout, FocusBanner, Footer, Header, Navigation, NoticeBanner, Panel } from './components.js';
import {
  DiagnosticsPage,
  EasyModeView,
  HelpPage,
  HomePage,
  MealsPage,
  SchoolsPage,
  SettingsPage,
  SplashScreen,
  TeacherPage,
  TimetablePage,
} from './pages.js';
import {
  clamp,
  isTypingInput,
  pageIndexFor,
  resolvePageShortcut,
  resolveRecentSchoolShortcut,
} from './shortcuts.js';
import {
  HUMAN_PAGES,
  createInitialAsyncPageStates,
  createInitialSettingsState,
  isAsyncDataPage,
  type AsyncDataPageId,
  type AsyncPageDataMap,
  type AsyncPageStateMap,
  type EasyState,
  type InteractiveMode,
  type KeyLike,
  type SearchState,
  type SettingsActionId,
  type SettingsDialog,
  type SettingsState,
} from './types.js';
import {
  activateHumanProfileSelection,
  clearHumanDefaultSchoolSelection,
  clearHumanActiveProfileSelection,
  loadHumanDiagnostics,
  loadHumanHomeData,
  loadHumanSessionContext,
  loadHumanTeacherData,
  loadHumanWeekTimetable,
  loadHumanWeeklyMeals,
  removeHumanProfileSelection,
  removeHumanRecentSchoolSelection,
  saveHumanSessionProfile,
  saveEasyProfile,
  saveHumanDefaultSchoolSelection,
  searchHumanSchools,
  type HumanSessionContext,
} from '../usecases/human.js';
import {
  buildSettingsActions,
  buildSettingsDialog,
  cycleSettingsSection,
  isDestructiveSettingsAction,
  moveSettingsSelection,
} from './settings.js';
import { pageTone } from './theme.js';
import type { AccentTone } from './theme.js';

interface InteractiveOptions {
  mode: InteractiveMode;
  splash?: boolean;
}

interface NoticeState {
  title: string;
  message: string;
  accent: AccentTone;
}

type LineInputTarget = 'school-query' | 'easy-school-query' | 'easy-teacher-name';

interface LineInputState {
  target: LineInputTarget;
  title: string;
  description: string;
  accent: AccentTone;
}

export function canRunInteractiveCli(
  stdinIsTty = Boolean(process.stdin.isTTY),
  stdoutIsTty = Boolean(process.stdout.isTTY),
): boolean {
  return stdinIsTty && stdoutIsTty;
}

export async function runInteractiveCli(options: InteractiveOptions): Promise<void> {
  if (!canRunInteractiveCli()) {
    throw new Error('Interactive human/easy mode requires an interactive TTY terminal.');
  }

  const app = render(<InteractiveCliApp mode={options.mode} splash={options.splash ?? true} />);
  await app.waitUntilExit();
}

function InteractiveCliApp({ mode, splash }: InteractiveOptions) {
  const { exit } = useApp();
  const { stdin, setRawMode, isRawModeSupported } = useStdin();
  const [effectiveMode, setEffectiveMode] = useState<InteractiveMode>(mode);
  const [showSplash, setShowSplash] = useState(Boolean(splash));
  const [session, setSession] = useState<HumanSessionContext | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [notice, setNotice] = useState<NoticeState | null>(
    mode === 'easy'
      ? {
          title: 'Easy mode ready',
          message: 'Easy mode will guide you through school and profile setup.',
          accent: 'blue',
        }
      : null,
  );
  const [lineInput, setLineInput] = useState<LineInputState | undefined>(undefined);
  const [pageStates, setPageStates] = useState<AsyncPageStateMap>(createInitialAsyncPageStates);
  const [settingsState, setSettingsState] = useState<SettingsState>(createInitialSettingsState);
  const [settingsDialog, setSettingsDialog] = useState<SettingsDialog | undefined>(undefined);
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    dirty: false,
    loading: false,
    results: [],
    selectedIndex: 0,
  });
  const [easyState, setEasyState] = useState<EasyState>({
    step: 'welcome',
    query: '',
    dirty: false,
    loading: false,
    results: [],
    selectedIndex: 0,
    grade: 3,
    classNo: 1,
    teacherName: '',
  });

  const currentPage = HUMAN_PAGES[pageIndex] ?? HUMAN_PAGES[0];
  const currentAsyncPageState = isAsyncDataPage(currentPage.id)
    ? pageStates[currentPage.id]
    : undefined;
  const inputLocked =
    effectiveMode === 'easy'
      ? easyState.loading || easyState.step === 'saving'
      : loadingSession || searchState.loading || currentAsyncPageState?.loading;

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    if (!showSplash) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    if (effectiveMode !== 'human' || showSplash || !session || !isAsyncDataPage(currentPage.id)) {
      return;
    }

    const pageId = currentPage.id;
    let active = true;
    setAsyncPageState(pageId, { loading: true, error: undefined });

    void loadAsyncPage(pageId, session)
      .then((data) => {
        if (!active) {
          return;
        }

        replaceAsyncPageState(pageId, {
          loading: false,
          error: undefined,
          data,
        } as AsyncPageStateMap[typeof pageId]);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        replaceAsyncPageState(pageId, {
          loading: false,
          error: error instanceof Error ? error.message : String(error),
          data: undefined,
        } as AsyncPageStateMap[typeof pageId]);
      });

    return () => {
      active = false;
    };
  }, [currentPage.id, effectiveMode, session, showSplash]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setEasyState((current) => ({
      ...current,
      grade: session.grade ?? current.grade,
      classNo: session.classNo ?? current.classNo,
      teacherName: session.teacherName ?? current.teacherName,
    }));

    if (!searchState.query && session.selectedSchool?.name) {
      setSearchState((current) => ({
        ...current,
        query: session.selectedSchool?.name ?? '',
      }));
    }

    setSettingsState((current) => alignSettingsState(current, session));
  }, [session]);

  useEffect(() => {
    if (currentPage.id !== 'settings' && settingsDialog) {
      setSettingsDialog(undefined);
    }
  }, [currentPage.id, settingsDialog]);

  useEffect(() => {
    if (!lineInput) {
      return undefined;
    }

    if (!isRawModeSupported) {
      setLineInput(undefined);
      setNotice({
        title: 'Input fallback',
        message: 'This terminal does not support IME-safe line capture. Continue with direct typing.',
        accent: 'yellow',
      });
      return undefined;
    }

    let active = true;
    let buffer = '';
    stdin.setEncoding('utf8');
    stdin.resume();
    setRawMode(false);

    const onData = (chunk: string | Buffer) => {
      if (!active) {
        return;
      }

      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      if (text.includes('\u0003')) {
        exit();
        return;
      }

      buffer += text;
      if (!/[\r\n]/u.test(text)) {
        return;
      }

      const value = buffer.replace(/\r?\n/gu, '');
      buffer = '';
      process.stdout.write('\u001b[2K\r');
      applyLineInputValue(lineInput.target, value);
    };

    stdin.on('data', onData);

    return () => {
      active = false;
      stdin.off('data', onData);
      setRawMode(true);
    };
  }, [exit, isRawModeSupported, lineInput, setRawMode, stdin]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (showSplash) {
      if (key.return || key.escape || isTypingInput(input, key)) {
        setShowSplash(false);
      }
      return;
    }

    if (effectiveMode === 'easy') {
      handleEasyInput(input, key);
      return;
    }

    handleHumanInput(input, key);
  }, { isActive: !lineInput });

  const headerSummary = useMemo(
    () => ({
      school: session?.selectedSchool?.name ?? 'No school selected',
      profile: session?.activeProfile?.name ?? 'No active profile',
      access: session?.configStatus.neisApiKeyConfigured ? 'official-full' : 'official-limited',
    }),
    [session],
  );

  const focusState = useMemo(() => {
    if (effectiveMode === 'easy') {
      return deriveEasyFocusState(easyState, lineInput);
    }

    return deriveHumanFocusState(currentPage.id, settingsState, settingsDialog, lineInput);
  }, [currentPage.id, easyState, effectiveMode, lineInput, settingsDialog, settingsState]);

  function setInfoNotice(message: string, title = 'Live notice', accent: AccentTone = 'cyan'): void {
    setNotice({
      title,
      message,
      accent,
    });
  }

  function setAsyncPageState<K extends AsyncDataPageId>(
    page: K,
    next: Partial<AsyncPageStateMap[K]>,
  ): void {
    setPageStates((current) => ({
      ...current,
      [page]: {
        ...current[page],
        ...next,
      },
    }));
  }

  function replaceAsyncPageState<K extends AsyncDataPageId>(
    page: K,
    next: AsyncPageStateMap[K],
  ): void {
    setPageStates((current) => ({
      ...current,
      [page]: next,
    }));
  }

  async function refreshSession(nextNotice?: string): Promise<void> {
    setLoadingSession(true);
    setSessionError(null);

    try {
      const nextSession = await loadHumanSessionContext();
      applyNextSession(nextSession, nextNotice);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingSession(false);
    }
  }

  function applyNextSession(nextSession: HumanSessionContext, nextNotice?: string): void {
    setSession(nextSession);
    setSettingsState((current) => alignSettingsState(current, nextSession));
    setSettingsDialog(undefined);
    if (nextNotice) {
      setInfoNotice(nextNotice);
    }
  }

  async function runSessionMutation(
    task: () => Promise<HumanSessionContext>,
    nextNotice: string,
  ): Promise<void> {
    setLoadingSession(true);
    setSessionError(null);

    try {
      const nextSession = await task();
      applyNextSession(nextSession, nextNotice);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingSession(false);
    }
  }

  async function refreshCurrentPage(): Promise<void> {
    if (!session || !isAsyncDataPage(currentPage.id)) {
      return;
    }

    const pageId = currentPage.id;
    setAsyncPageState(pageId, {
      loading: true,
      error: undefined,
    });

    try {
      const data = await loadAsyncPage(pageId, session);
      replaceAsyncPageState(pageId, {
        loading: false,
        error: undefined,
        data,
      } as AsyncPageStateMap[typeof pageId]);
    } catch (error) {
      replaceAsyncPageState(pageId, {
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        data: undefined,
      } as AsyncPageStateMap[typeof pageId]);
    }
  }

  async function runSchoolSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchState((current) => ({
        ...current,
        error: 'Type a school name before searching.',
      }));
      return;
    }

    setSearchState((current) => ({
      ...current,
      loading: true,
      error: undefined,
    }));

    try {
      const results = await searchHumanSchools(trimmed);
      setSearchState((current) => ({
        ...current,
        loading: false,
        dirty: false,
        results,
        selectedIndex: 0,
      }));
      setInfoNotice(
        results.length
          ? `Loaded ${results.length} school result(s).`
          : 'No schools matched that keyword.',
        'Search results',
        results.length ? 'cyan' : 'yellow',
      );
    } catch (error) {
      setSearchState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function applySchoolSelection(): Promise<void> {
    const selected = searchState.results[searchState.selectedIndex];
    if (!selected) {
      return;
    }

    setSearchState((current) => ({
      ...current,
      loading: true,
      error: undefined,
    }));

    try {
      const nextSession = await saveHumanDefaultSchoolSelection(selected);
      applyNextSession(nextSession, `Selected ${selected.name} as the current school.`);
      setSearchState((current) => ({
        ...current,
        loading: false,
        query: selected.name,
        dirty: false,
      }));
    } catch (error) {
      setSearchState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function runEasySearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      setEasyState((current) => ({
        ...current,
        error: 'Type a school name before searching.',
      }));
      return;
    }

    setEasyState((current) => ({
      ...current,
      loading: true,
      error: undefined,
    }));

    try {
      const results = await searchHumanSchools(trimmed);
      setEasyState((current) => ({
        ...current,
        loading: false,
        dirty: false,
        results,
        selectedIndex: 0,
        step: 'search',
      }));
    } catch (error) {
      setEasyState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  async function finishEasyMode(): Promise<void> {
    const selected = easyState.results[easyState.selectedIndex];
    if (!selected) {
      setEasyState((current) => ({
        ...current,
        error: 'Select a school before saving easy mode.',
      }));
      return;
    }

    setEasyState((current) => ({
      ...current,
      loading: true,
      step: 'saving',
      error: undefined,
    }));

    try {
      const nextSession = await saveEasyProfile({
        school: selected,
        grade: easyState.grade,
        classNo: easyState.classNo,
        teacherName: easyState.teacherName || undefined,
      });
      applyNextSession(
        nextSession,
        `Easy mode saved "easy-default" and selected ${selected.name}.`,
      );
      setEffectiveMode('human');
      setPageIndex(0);
    } catch (error) {
      setEasyState((current) => ({
        ...current,
        loading: false,
        step: 'teacher',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  function handleHumanInput(input: string, key: KeyLike): void {
    if (inputLocked) {
      return;
    }

    const shortcutPage = resolvePageShortcut(input);
    if (shortcutPage) {
      const shortcutIndex = pageIndexFor(shortcutPage);
      if (shortcutIndex >= 0) {
        setPageIndex(shortcutIndex);
      }
      return;
    }

    if (currentPage.id !== 'schools' && !key.meta && !key.ctrl && input === 'q') {
      exit();
      return;
    }

    if (currentPage.id === 'settings' && handleSettingsInput(input, key)) {
      return;
    }

    if (key.leftArrow) {
      setPageIndex((current) => (current - 1 + HUMAN_PAGES.length) % HUMAN_PAGES.length);
      return;
    }
    if (key.rightArrow || key.tab) {
      setPageIndex((current) => (current + 1) % HUMAN_PAGES.length);
      return;
    }
    if (input === 'r') {
      void refreshCurrentPage();
      return;
    }
    if (input === 'e') {
      setEffectiveMode('easy');
      setEasyState((current) => ({
        ...current,
        step: 'welcome',
      }));
      setInfoNotice('Switched to easy mode.', 'Mode changed', 'blue');
      return;
    }
    if (currentPage.id !== 'schools') {
      return;
    }
    handleSchoolsInput(input, key);
  }

  function handleSchoolsInput(input: string, key: KeyLike): void {
    if (input === 'i') {
      beginLineInput({
        target: 'school-query',
        title: 'School query capture',
        description: 'Type the school name on the terminal line below, then press Enter to search. This path is safer for Korean IME input.',
        accent: 'magenta',
      });
      return;
    }

    const recentIndex = resolveRecentSchoolShortcut(input);
    if (
      recentIndex != null &&
      session &&
      !searchState.query
    ) {
      const selectedRecentSchool = session.recentSchools[recentIndex];
      if (selectedRecentSchool) {
        void runSessionMutation(
          () => saveHumanDefaultSchoolSelection(selectedRecentSchool),
          `Selected ${selectedRecentSchool.name} as the current school.`,
        );
      }
      return;
    }

    if (key.upArrow) {
      setSearchState((current) => ({
        ...current,
        selectedIndex: Math.max(0, current.selectedIndex - 1),
      }));
      return;
    }
    if (key.downArrow) {
      setSearchState((current) => ({
        ...current,
        selectedIndex: clamp(
          current.selectedIndex + 1,
          0,
          Math.max(0, current.results.length - 1),
        ),
      }));
      return;
    }
    if (key.return) {
      if (searchState.dirty || !searchState.results.length) {
        void runSchoolSearch(searchState.query);
        return;
      }
      void applySchoolSelection();
      return;
    }
    if (key.escape) {
      setSearchState({
        query: '',
        dirty: false,
        loading: false,
        results: [],
        selectedIndex: 0,
      });
      setInfoNotice('Cleared school search input.', 'Search cleared', 'yellow');
      return;
    }
    if (key.backspace || key.delete) {
      setSearchState((current) => applyQueryEdit(current, current.query.slice(0, -1)));
      return;
    }
    if (isTypingInput(input, key)) {
      setSearchState((current) => applyQueryEdit(current, `${current.query}${input}`));
    }
  }

  function handleSettingsInput(_input: string, key: KeyLike): boolean {
    if (!session) {
      return false;
    }

    if (settingsDialog) {
      if (key.escape) {
        setSettingsDialog(undefined);
        setInfoNotice('Cancelled the pending settings action.', 'Settings unchanged', 'yellow');
        return true;
      }
      if (key.return) {
        const actionId = settingsDialog.actionId;
        setSettingsDialog(undefined);
        executeSettingsAction(actionId);
        return true;
      }
      return true;
    }

    if (key.tab) {
      setSettingsState((current) => ({
        ...current,
        section: cycleSettingsSection(current.section),
      }));
      return true;
    }

    if (key.upArrow) {
      setSettingsState((current) => moveSettingsSelection(current, session, -1));
      return true;
    }

    if (key.downArrow) {
      setSettingsState((current) => moveSettingsSelection(current, session, 1));
      return true;
    }

    if (key.return) {
      if (settingsState.section === 'profiles') {
        const selectedProfile = session.configStatus.profiles[settingsState.profileIndex];
        if (selectedProfile) {
          void runSessionMutation(
            () => activateHumanProfileSelection(selectedProfile.name),
            `Activated profile ${selectedProfile.name}.`,
          );
        }
      } else if (settingsState.section === 'recent-schools') {
        const selectedSchool = session.recentSchools[settingsState.recentSchoolIndex];
        if (selectedSchool) {
          void runSessionMutation(
            () => saveHumanDefaultSchoolSelection(selectedSchool),
            `Selected ${selectedSchool.name} as the current school.`,
          );
        }
      } else {
        const action = buildSettingsActions(session, settingsState)[settingsState.actionIndex];
        if (!action || action.disabled) {
          return true;
        }

        if (isDestructiveSettingsAction(action.id)) {
          setSettingsDialog(buildSettingsDialog(action.id, session, settingsState));
        } else {
          executeSettingsAction(action.id);
        }
      }
      return true;
    }

    return false;
  }

  function executeSettingsAction(actionId: SettingsActionId): void {
    if (!session) {
      return;
    }

    switch (actionId) {
      case 'save-active-profile':
        if (session.activeProfile?.name) {
          void runSessionMutation(
            () => saveHumanSessionProfile(session, session.activeProfile!.name, { activate: true }),
            `Saved the current setup to ${session.activeProfile.name}.`,
          );
        }
        break;
      case 'save-shell-profile':
        void runSessionMutation(
          () => saveHumanSessionProfile(session, 'human-shell', { activate: true }),
          'Saved the current setup to human-shell and activated it.',
        );
        break;
      case 'clear-active-profile':
        void runSessionMutation(
          () => clearHumanActiveProfileSelection(),
          'Cleared the active profile.',
        );
        break;
      case 'clear-default-school':
        void runSessionMutation(
          () => clearHumanDefaultSchoolSelection(),
          'Cleared the default school.',
        );
        break;
      case 'remove-selected-profile': {
        const selectedProfile = session.configStatus.profiles[settingsState.profileIndex];
        if (selectedProfile) {
          void runSessionMutation(
            () => removeHumanProfileSelection(selectedProfile.name),
            `Removed profile ${selectedProfile.name}.`,
          );
        }
        break;
      }
      case 'remove-selected-recent-school': {
        const selectedRecentSchool = session.recentSchools[settingsState.recentSchoolIndex];
        if (selectedRecentSchool) {
          void runSessionMutation(
            () => removeHumanRecentSchoolSelection(selectedRecentSchool),
            `Removed ${selectedRecentSchool.name} from recent schools.`,
          );
        }
        break;
      }
      case 'refresh-session':
        void refreshSession('Refreshed shell session.');
        break;
    }
  }

  function handleEasyInput(input: string, key: KeyLike): void {
    if (inputLocked) {
      return;
    }
    if (key.escape) {
      if (easyState.step === 'welcome') {
        setEffectiveMode('human');
        setInfoNotice('Returned to human mode.', 'Mode changed', 'blue');
        return;
      }
      setEasyState((current) => ({
        ...current,
        step: current.step === 'teacher' ? 'class' : 'search',
      }));
      return;
    }
    if (easyState.step === 'welcome') {
      if (key.return || isTypingInput(input, key)) {
        setEasyState((current) => ({
          ...current,
          step: 'search',
        }));
      }
      return;
    }
    if (easyState.step === 'search') {
      if (input === 'i') {
        beginLineInput({
          target: 'easy-school-query',
          title: 'School query capture',
          description: 'Type the school name on the terminal line below, then press Enter to search. This path is safer for Korean IME input.',
          accent: 'magenta',
        });
        return;
      }
      if (key.upArrow) {
        setEasyState((current) => ({
          ...current,
          selectedIndex: Math.max(0, current.selectedIndex - 1),
        }));
        return;
      }
      if (key.downArrow) {
        setEasyState((current) => ({
          ...current,
          selectedIndex: clamp(
            current.selectedIndex + 1,
            0,
            Math.max(0, current.results.length - 1),
          ),
        }));
        return;
      }
      if (key.return) {
        if (easyState.dirty || !easyState.results.length) {
          void runEasySearch(easyState.query);
          return;
        }
        setEasyState((current) => ({
          ...current,
          step: 'class',
          error: undefined,
        }));
        return;
      }
      if (key.backspace || key.delete) {
        setEasyState((current) => applyQueryEdit(current, current.query.slice(0, -1)));
        return;
      }
      if (isTypingInput(input, key)) {
        setEasyState((current) => applyQueryEdit(current, `${current.query}${input}`));
      }
      return;
    }
    if (easyState.step === 'class') {
      if (key.upArrow) {
        setEasyState((current) => ({
          ...current,
          grade: clamp(current.grade + 1, 1, 6),
        }));
        return;
      }
      if (key.downArrow) {
        setEasyState((current) => ({
          ...current,
          grade: clamp(current.grade - 1, 1, 6),
        }));
        return;
      }
      if (key.rightArrow) {
        setEasyState((current) => ({
          ...current,
          classNo: clamp(current.classNo + 1, 1, 30),
        }));
        return;
      }
      if (key.leftArrow) {
        setEasyState((current) => ({
          ...current,
          classNo: clamp(current.classNo - 1, 1, 30),
        }));
        return;
      }
      if (key.return) {
        setEasyState((current) => ({
          ...current,
          step: 'teacher',
        }));
      }
      return;
    }
    if (easyState.step === 'teacher') {
      if (input === 'i') {
        beginLineInput({
          target: 'easy-teacher-name',
          title: 'Teacher name capture',
          description: 'Type the teacher name on the terminal line below, then press Enter to save it. This path is safer for Korean IME input.',
          accent: 'magenta',
        });
        return;
      }
      if (key.return) {
        void finishEasyMode();
        return;
      }
      if (key.backspace || key.delete) {
        setEasyState((current) => ({
          ...current,
          teacherName: current.teacherName.slice(0, -1),
        }));
        return;
      }
      if (isTypingInput(input, key)) {
        setEasyState((current) => ({
          ...current,
          teacherName: `${current.teacherName}${input}`,
        }));
      }
    }
  }

  function beginLineInput(next: LineInputState): void {
    setLineInput(next);
    setNotice({
      title: next.title,
      message: next.description,
      accent: next.accent,
    });
  }

  function applyLineInputValue(target: LineInputTarget, value: string): void {
    setLineInput(undefined);

    switch (target) {
      case 'school-query':
        setSearchState((current) => applyQueryEdit(current, value));
        void runSchoolSearch(value);
        return;
      case 'easy-school-query':
        setEasyState((current) => applyQueryEdit(current, value));
        void runEasySearch(value);
        return;
      case 'easy-teacher-name':
        setEasyState((current) => ({
          ...current,
          teacherName: value,
          error: undefined,
        }));
        setInfoNotice('Updated the teacher shortcut field.', 'Teacher field updated', 'green');
        return;
    }
  }

  if (showSplash) {
    return <SplashScreen mode={mode} />;
  }

  if (effectiveMode === 'easy') {
    return (
      <Box flexDirection="column">
        <NoticeBanner notice={notice} />
        <FocusBanner focus={focusState} />
        {lineInput ? (
          <Callout title={lineInput.title} accent={lineInput.accent}>
            {lineInput.description}
          </Callout>
        ) : null}
        <EasyModeView
          easyState={easyState}
          session={session}
          lineInputTarget={
            lineInput?.target === 'easy-school-query' || lineInput?.target === 'easy-teacher-name'
              ? lineInput.target
              : undefined
          }
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header summary={headerSummary} subtitle={KAMPUS_TAGLINE} />
      <NoticeBanner notice={notice} />
      {sessionError ? (
        <Panel title="Session Error" accent="red">
          <Text color="red">{sessionError}</Text>
        </Panel>
      ) : null}
      <Navigation pageIndex={pageIndex} />
      <FocusBanner focus={focusState} />
      {lineInput ? (
        <Callout title={lineInput.title} accent={lineInput.accent}>
          {lineInput.description}
        </Callout>
      ) : null}
      <Panel
        title={currentPage.label}
        subtitle={currentPage.description}
        accent={pageTone(currentPage.id)}
      >
        {loadingSession || !session ? (
          <Text color="yellow">Loading Kampus session...</Text>
        ) : (
          <HumanShellPage
            page={currentPage.id}
            session={session}
            searchState={searchState}
            pageStates={pageStates}
            settingsState={settingsState}
            settingsDialog={settingsDialog}
            lineInputActive={lineInput?.target === 'school-query'}
          />
        )}
      </Panel>
      <Footer page={currentPage.id} mode="human" />
    </Box>
  );
}

function HumanShellPage({
  page,
  session,
  searchState,
  pageStates,
  settingsState,
  settingsDialog,
  lineInputActive,
}: {
  page: (typeof HUMAN_PAGES)[number]['id'];
  session: HumanSessionContext;
  searchState: SearchState;
  pageStates: AsyncPageStateMap;
  settingsState: SettingsState;
  settingsDialog?: SettingsDialog;
  lineInputActive?: boolean;
}) {
  switch (page) {
    case 'home':
      return pageStates.home.loading ? (
        <Text color="yellow">Refreshing home...</Text>
      ) : pageStates.home.error ? (
        <Text color="red">{pageStates.home.error}</Text>
      ) : (
        <HomePage session={session} data={pageStates.home.data} />
      );
    case 'schools':
      return <SchoolsPage session={session} searchState={searchState} lineInputActive={lineInputActive} />;
    case 'timetable':
      return pageStates.timetable.loading ? (
        <Text color="yellow">Refreshing timetable...</Text>
      ) : pageStates.timetable.error ? (
        <Text color="red">{pageStates.timetable.error}</Text>
      ) : (
        <TimetablePage data={pageStates.timetable.data} />
      );
    case 'meals':
      return pageStates.meals.loading ? (
        <Text color="yellow">Refreshing meals...</Text>
      ) : pageStates.meals.error ? (
        <Text color="red">{pageStates.meals.error}</Text>
      ) : (
        <MealsPage data={pageStates.meals.data} />
      );
    case 'teacher':
      return pageStates.teacher.loading ? (
        <Text color="yellow">Refreshing teacher...</Text>
      ) : pageStates.teacher.error ? (
        <Text color="red">{pageStates.teacher.error}</Text>
      ) : (
        <TeacherPage session={session} data={pageStates.teacher.data} />
      );
    case 'diagnostics':
      return pageStates.diagnostics.loading ? (
        <Text color="yellow">Refreshing diagnostics...</Text>
      ) : pageStates.diagnostics.error ? (
        <Text color="red">{pageStates.diagnostics.error}</Text>
      ) : (
        <DiagnosticsPage data={pageStates.diagnostics.data} />
      );
    case 'settings':
      return <SettingsPage session={session} settingsState={settingsState} dialog={settingsDialog} />;
    case 'help':
      return <HelpPage session={session} />;
    default:
      return <Text color="gray">No page renderer.</Text>;
  }
}

async function loadAsyncPage<K extends AsyncDataPageId>(
  page: K,
  session: HumanSessionContext,
): Promise<AsyncPageDataMap[K]> {
  switch (page) {
    case 'home':
      return (await loadHumanHomeData(session)) as AsyncPageDataMap[K];
    case 'timetable':
      return (await loadHumanWeekTimetable(session)) as AsyncPageDataMap[K];
    case 'meals':
      return (await loadHumanWeeklyMeals(session)) as AsyncPageDataMap[K];
    case 'teacher':
      return (await loadHumanTeacherData(session)) as AsyncPageDataMap[K];
    case 'diagnostics':
      return (await loadHumanDiagnostics(session)) as AsyncPageDataMap[K];
  }
}

export function alignSettingsState(
  current: SettingsState,
  session: HumanSessionContext,
): SettingsState {
  const activeProfileIndex = Math.max(
    0,
    session.configStatus.profiles.findIndex((profile) => profile.name === session.activeProfile?.name),
  );
  const currentSchoolIndex = Math.max(
    0,
    session.recentSchools.findIndex(
      (school) =>
        school.name === session.selectedSchool?.name &&
        (school.region ?? '') === (session.selectedSchool?.region ?? ''),
    ),
  );

  return {
    section:
      current.section === 'recent-schools'
        ? session.recentSchools.length
          ? 'recent-schools'
          : 'profiles'
        : current.section === 'actions'
          ? 'actions'
          : 'profiles',
    profileIndex:
      session.configStatus.profiles.length === 0 ? 0 : activeProfileIndex,
    recentSchoolIndex:
      session.recentSchools.length === 0 ? 0 : currentSchoolIndex,
    actionIndex: clamp(current.actionIndex, 0, Math.max(0, buildSettingsActions(session, current).length - 1)),
  };
}

type QueryEditState = {
  query: string;
  dirty: boolean;
  error?: string;
  results: SearchState['results'];
  selectedIndex: number;
};

export function applyQueryEdit<T extends QueryEditState>(state: T, query: string): T {
  return {
    ...state,
    query,
    dirty: true,
    error: undefined,
    results: [],
    selectedIndex: 0,
  };
}

function deriveHumanFocusState(
  page: (typeof HUMAN_PAGES)[number]['id'],
  settingsState: SettingsState,
  settingsDialog?: SettingsDialog,
  lineInput?: LineInputState,
): { title: string; description: string; accent: AccentTone } {
  if (lineInput) {
    return {
      title: lineInput.title,
      description: lineInput.description,
      accent: lineInput.accent,
    };
  }

  if (page === 'schools') {
    return {
      title: 'School query',
      description: 'The school query field owns text input. Press I for IME-safe line capture, Enter to search, and Enter again to apply the highlighted result.',
      accent: 'magenta',
    };
  }

  if (page === 'settings') {
    if (settingsDialog) {
      return {
        title: 'Settings confirmation',
        description: 'The confirmation dialog owns input. Press Enter to confirm or Esc to cancel.',
        accent: 'red',
      };
    }

    const sectionTitle =
      settingsState.section === 'profiles'
        ? 'Profiles pane'
        : settingsState.section === 'recent-schools'
          ? 'Recent schools pane'
          : 'Actions pane';
    return {
      title: sectionTitle,
      description: 'Use Tab to switch panes, Up and Down to move the selection, and Enter to apply the focused item.',
      accent: 'yellow',
    };
  }

  return {
    title: 'Page navigation',
    description: 'Use Left and Right arrows or page shortcuts to move through the command deck. Read-only pages do not capture free text input.',
    accent: pageTone(page),
  };
}

function deriveEasyFocusState(
  easyState: EasyState,
  lineInput?: LineInputState,
): { title: string; description: string; accent: AccentTone } {
  if (lineInput) {
    return {
      title: lineInput.title,
      description: lineInput.description,
      accent: lineInput.accent,
    };
  }

  switch (easyState.step) {
    case 'welcome':
      return {
        title: 'Welcome prompt',
        description: 'Press Enter to begin guided setup or Esc to return to human mode.',
        accent: 'blue',
      };
    case 'search':
      return {
        title: 'School query',
        description: 'The school query field owns input. Press I for IME-safe line capture, Enter to search, and Enter again to accept the highlighted school.',
        accent: 'magenta',
      };
    case 'class':
      return {
        title: 'Grade and class selector',
        description: 'Use Up and Down to change grade, Left and Right to change class, then press Enter to continue.',
        accent: 'blue',
      };
    case 'teacher':
      return {
        title: 'Teacher name',
        description: 'Type a teacher name or press I for IME-safe line capture, then press Enter to save the easy-mode profile.',
        accent: 'magenta',
      };
    case 'saving':
      return {
        title: 'Saving profile',
        description: 'Easy mode is writing the selected school and class setup into the active profile.',
        accent: 'green',
      };
  }
}

