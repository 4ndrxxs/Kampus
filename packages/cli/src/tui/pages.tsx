import { Box, Newline, Text } from 'ink';
import {
  describeSecretStorage,
  KAMPUS_DEVELOPER_INFO,
  KAMPUS_PROJECT_INFO,
  type TeacherTimetable,
  type WeekTimetable,
  type WeeklyMeals,
} from '@kampus/core';
import { KAMPUS_TAGLINE, getGradientLogoLines } from './logo.js';
import {
  Callout,
  DataStatusSummary,
  EmptyState,
  Footer,
  Header,
  InfoLine,
  IssueList,
  ListRow,
  MetricCard,
  Panel,
  StepTrack,
} from './components.js';
import { buildSettingsActions } from './settings.js';
import type {
  EasyState,
  HumanDiagnosticsData,
  HumanMealsData,
  HumanSessionContext,
  HumanTeacherData,
  HumanTimetableData,
  InteractiveMode,
  SearchState,
  SettingsDialog,
  SettingsState,
} from './types.js';
import type { HumanHomeData } from '../usecases/human.js';

export function SplashScreen({ mode }: { mode: InteractiveMode }) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Panel
        title={mode === 'easy' ? 'Easy Mode Boot' : 'Human Shell Boot'}
        subtitle="Interactive terminal workspace"
        accent="blue"
      >
        <Box flexDirection="column">
          {getGradientLogoLines().map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
          <Newline />
          <Text color="cyan">{KAMPUS_TAGLINE}</Text>
          <Text color="gray">
            {mode === 'easy'
              ? 'Preparing guided setup for school, class, and teacher defaults.'
              : 'Preparing the operations deck for interactive school data work.'}
          </Text>
          <Callout title="Launch" accent="yellow">
            Press any key to continue immediately.
          </Callout>
        </Box>
      </Panel>
    </Box>
  );
}

export function HomePage({
  session,
  data,
}: {
  session: HumanSessionContext;
  data?: HumanHomeData;
}) {
  const notes = [...session.notes, ...(data?.notes ?? [])];
  const nextClassValue = data?.nextClass
    ? `P${data.nextClass.period.period} ${data.nextClass.period.subject}`
    : 'No upcoming class';

  return (
    <Box flexDirection="column">
      <Panel title="Mission Control" subtitle="Live session summary" accent="blue">
        <Box flexWrap="wrap">
          <MetricCard
            label="School"
            value={renderSchoolLabel(session.selectedSchool?.name, session.selectedSchool?.region)}
            note="Default school context"
            accent="cyan"
            width={34}
          />
          <MetricCard
            label="Class"
            value={session.grade && session.classNo ? `${session.grade}-${session.classNo}` : 'Not set'}
            note="Student view target"
            accent="blue"
            width={20}
          />
          <MetricCard
            label="Teacher"
            value={session.teacherName ?? 'Not set'}
            note="Teacher page target"
            accent="magenta"
            width={26}
          />
          <MetricCard
            label="Next class"
            value={nextClassValue}
            note={
              data?.nextClass?.minutesUntil != null
                ? `Starts in ${data.nextClass.minutesUntil} min`
                : 'Live class countdown'
            }
            accent="green"
            width={30}
          />
        </Box>
        {data?.classTimes?.length ? (
          <Callout title="Class-time rail" accent="cyan">
            <Text color="gray">
              {data.classTimes
                .slice(0, 4)
                .map((slot) => `P${slot.period} ${slot.startTime}-${slot.endTime}`)
                .join('   ')}
            </Text>
          </Callout>
        ) : null}
      </Panel>

      <Panel title="Today timetable" subtitle="Student view" accent="cyan">
        <DataStatusSummary
          label="Status"
          status={data?.todayTimetable?.dataStatus}
          warnings={data?.todayTimetable?.warnings}
        />
        <Box flexDirection="column" marginTop={1}>
          {data?.todayTimetable?.periods.length ? (
            data.todayTimetable.periods.slice(0, 8).map((period) => (
              <ListRow
                key={period.period}
                accent="cyan"
                leading={`P${period.period}`}
                primary={period.subject}
                secondary={period.teacher ? `[${period.teacher}]` : undefined}
              />
            ))
          ) : (
            <EmptyState
              title="Timetable idle"
              message="No student timetable is loaded for today yet."
            />
          )}
        </Box>
      </Panel>

      <Panel title="Today meals" subtitle="Meal board" accent="green">
        <DataStatusSummary
          label="Status"
          status={data?.todayMeals?.dataStatus}
          warnings={data?.todayMeals?.warnings}
        />
        <Box flexDirection="column" marginTop={1}>
          {data?.todayMeals?.meals.length ? (
            data.todayMeals.meals.map((meal) => (
              <ListRow
                key={meal.type}
                accent="green"
                primary={meal.type}
                secondary={meal.items.slice(0, 4).map((item) => item.name).join(', ')}
              />
            ))
          ) : (
            <EmptyState title="Meals idle" message="No meal rows are loaded for today yet." />
          )}
        </Box>
      </Panel>

      <Panel title="Alerts and setup" subtitle="Notes, gaps, and guidance" accent="yellow">
        <Box flexDirection="column">
          {notes.length ? (
            notes.map((note) => (
              <Text key={note} color="gray">
                - {note}
              </Text>
            ))
          ) : (
            <Text color="gray">No setup notes right now.</Text>
          )}
          <IssueList issues={data?.issues} title="Provider issues" />
        </Box>
      </Panel>
    </Box>
  );
}

export function SchoolsPage({
  session,
  searchState,
  lineInputActive,
}: {
  session: HumanSessionContext;
  searchState: SearchState;
  lineInputActive?: boolean;
}) {
  const queryValue = searchState.query || 'Type a school name';

  return (
    <Box flexDirection="column">
      <Panel title="Search console" subtitle="Find and apply a school" accent="magenta">
        <Box flexWrap="wrap">
          <MetricCard
            label="Current school"
            value={renderSchoolLabel(session.selectedSchool?.name, session.selectedSchool?.region)}
            note="Current shell target"
            accent="cyan"
            width={38}
          />
          <MetricCard
            label="Query"
            value={lineInputActive ? `${queryValue} [line capture active]` : `${queryValue} |`}
            note="Enter to query, I for IME-safe editing, Enter again to apply"
            accent="magenta"
            width={38}
          />
        </Box>
        {searchState.loading ? (
          <Callout title="Search in progress" accent="cyan">
            Searching schools...
          </Callout>
        ) : null}
        {searchState.error ? (
          <Callout title="Search issue" accent="red">
            {searchState.error}
          </Callout>
        ) : (
          <Text color="gray">
            Enter searches when the query changed. Enter again applies the highlighted school. Press I for IME-safe editing.
          </Text>
        )}
      </Panel>

      <Panel title="Results" subtitle="Merged Comcigan + NEIS candidates" accent="magenta">
        <Box flexDirection="column">
          {searchState.results.length ? (
            searchState.results.slice(0, 8).map((school, index) => {
              const active = index === searchState.selectedIndex;
              return (
                <ListRow
                  key={`${school.name}-${school.region}-${index}`}
                  active={active}
                  accent="magenta"
                  leading={String(index + 1)}
                  primary={school.name}
                  secondary={school.region ? `(${school.region})` : undefined}
                  meta={school.schoolType}
                />
              );
            })
          ) : (
            <EmptyState
              title="No search results"
              message="Start typing a school name, then press Enter to query the merged search providers."
            />
          )}
        </Box>
      </Panel>

      <Panel title="Recent quick picks" subtitle="Fast reuse without retyping" accent="cyan">
        <Box flexDirection="column">
          {session.recentSchools.slice(0, 9).length ? (
            session.recentSchools.slice(0, 9).map((school, index) => (
              <ListRow
                key={`${school.name}-${school.region}-${index}`}
                accent="cyan"
                primary={school.name}
                secondary={school.region ? `(${school.region})` : undefined}
                meta={isSameSchool(session.selectedSchool, school) ? 'current' : undefined}
                leading={`${index + 1}.`}
              />
            ))
          ) : (
            <EmptyState
              title="No quick picks yet"
              message="Once you use schools, the recent-school rail will appear here."
            />
          )}
          <Text color="gray">
            Press 1-9 when the search box is empty to reuse a recent school immediately.
          </Text>
        </Box>
      </Panel>
    </Box>
  );
}

export function TimetablePage({ data }: { data?: HumanTimetableData }) {
  return (
    <Box flexDirection="column">
      {data?.notes?.length ? (
        <Callout title="Timetable notes" accent="yellow">
          <Box flexDirection="column">
            {data.notes.map((note) => (
              <Text key={note} color="gray">
                - {note}
              </Text>
            ))}
          </Box>
        </Callout>
      ) : null}
      <DataStatusSummary
        label="Weekly timetable"
        status={data?.week?.dataStatus}
        warnings={data?.week?.warnings}
      />
      {data?.week ? (
        <WeekTimetableView week={data.week} />
      ) : (
        <EmptyState title="Timetable idle" message="No weekly timetable is currently loaded." />
      )}
      <IssueList issues={data?.issues} />
    </Box>
  );
}

export function MealsPage({ data }: { data?: HumanMealsData }) {
  return (
    <Box flexDirection="column">
      {data?.notes?.length ? (
        <Callout title="Meals notes" accent="yellow">
          <Box flexDirection="column">
            {data.notes.map((note) => (
              <Text key={note} color="gray">
                - {note}
              </Text>
            ))}
          </Box>
        </Callout>
      ) : null}
      <DataStatusSummary
        label="Weekly meals"
        status={data?.week?.dataStatus}
        warnings={data?.week?.warnings}
      />
      {data?.week ? (
        <WeeklyMealsView week={data.week} />
      ) : (
        <EmptyState title="Meals idle" message="No weekly meals are currently loaded." />
      )}
      <IssueList issues={data?.issues} />
    </Box>
  );
}

export function TeacherPage({
  session,
  data,
}: {
  session: HumanSessionContext;
  data?: HumanTeacherData;
}) {
  return (
    <Box flexDirection="column">
      <Panel title="Teacher focus" subtitle="Current shell teacher context" accent="magenta">
        <Box flexWrap="wrap">
          <MetricCard
            label="Teacher"
            value={session.teacherName ?? 'Not set'}
            note="Teacher page target"
            accent="magenta"
            width={30}
          />
          <MetricCard
            label="School"
            value={renderSchoolLabel(session.selectedSchool?.name, session.selectedSchool?.region)}
            note="Current school context"
            accent="cyan"
            width={36}
          />
        </Box>
      </Panel>

      {data?.notes?.length ? (
        <Callout title="Teacher notes" accent="yellow">
          <Box flexDirection="column">
            {data.notes.map((note) => (
              <Text key={note} color="gray">
                - {note}
              </Text>
            ))}
          </Box>
        </Callout>
      ) : null}

      <Panel title="Teacher profile" subtitle="Info card" accent="green">
        <DataStatusSummary
          label="Teacher info"
          status={data?.info?.dataStatus}
          warnings={data?.info?.warnings}
        />
        {data?.info ? (
          <Box flexWrap="wrap" marginTop={1}>
            <MetricCard label="Name" value={data.info.name} accent="green" width={28} />
            <MetricCard
              label="Subjects"
              value={data.info.subjects?.join(', ') || 'No subject data'}
              accent="cyan"
              width={36}
            />
            <MetricCard
              label="Classes"
              value={data.info.classes?.join(', ') || 'No class data'}
              accent="magenta"
              width={36}
            />
          </Box>
        ) : (
          <EmptyState title="Teacher info idle" message="No teacher info is loaded yet." />
        )}
      </Panel>

      <Panel title="Teacher timetable" subtitle="Weekly view" accent="magenta">
        <DataStatusSummary
          label="Teacher timetable"
          status={data?.timetable?.dataStatus}
          warnings={data?.timetable?.warnings}
        />
        {data?.timetable ? (
          <TeacherTimetableView timetable={data.timetable} />
        ) : (
          <EmptyState
            title="Teacher timetable idle"
            message="No teacher timetable is currently loaded."
          />
        )}
      </Panel>

      <IssueList issues={data?.issues} />
    </Box>
  );
}

export function DiagnosticsPage({ data }: { data?: HumanDiagnosticsData }) {
  if (!data) {
    return <EmptyState title="Diagnostics idle" message="No diagnostics were loaded." />;
  }

  return (
    <Box flexDirection="column">
      <Panel title="Config posture" subtitle="Auth and storage state" accent="yellow">
        <Box flexWrap="wrap">
          <MetricCard
            label="Key source"
            value={data.configStatus.neisApiKeySource}
            note="Current auth resolution path"
            accent="yellow"
            width={24}
          />
          <MetricCard
            label="Key storage"
            value={describeSecretStorage(
              data.configStatus.neisApiKeyStorage,
              data.configStatus.neisApiKeySource,
            )}
            note="Protected local storage mode"
            accent="blue"
            width={36}
          />
          <MetricCard
            label="Key preview"
            value={data.configStatus.neisApiKeyPreview ?? 'Not configured'}
            note="Masked key preview"
            accent="cyan"
            width={28}
          />
        </Box>
        <InfoLine label="Config path" value={data.configStatus.configPath} tone="yellow" />
      </Panel>

      <Panel title="Expected provider modes" subtitle="How the shell should behave" accent="cyan">
        <Box flexDirection="column">
          {data.expectedModes.map((entry) => (
            <ListRow
              key={entry.provider}
              accent={entry.provider === 'neis' ? 'cyan' : 'magenta'}
              primary={entry.provider}
              secondary={entry.accessMode}
              meta={entry.note}
            />
          ))}
        </Box>
      </Panel>

      <Panel title="Warning ledger" subtitle="Current operator-visible notes" accent="yellow">
        <Box flexDirection="column">
          {data.warnings.length ? (
            data.warnings.map((warning) => (
              <Text key={warning} color="yellow">
                - {warning}
              </Text>
            ))
          ) : (
            <Text color="gray">No current warnings.</Text>
          )}
        </Box>
      </Panel>
    </Box>
  );
}

export function SettingsPage({
  session,
  settingsState,
  dialog,
}: {
  session: HumanSessionContext;
  settingsState: SettingsState;
  dialog?: SettingsDialog;
}) {
  const config = session.configStatus;
  const selectedProfile = config.profiles[settingsState.profileIndex];
  const selectedRecentSchool = session.recentSchools[settingsState.recentSchoolIndex];
  const actions = buildSettingsActions(session, settingsState);
  const selectedAction = actions[settingsState.actionIndex];
  const activeProfileHasOwnSchool =
    Boolean(session.activeProfile?.school) &&
    session.activeProfile?.school?.name !== config.defaultSchool?.name;

  return (
    <Box flexDirection="column">
      <Panel title="Settings overview" subtitle="Profiles, defaults, and cache policy" accent="blue">
        <Box flexWrap="wrap">
          <MetricCard
            label="Active profile"
            value={session.activeProfile?.name ?? 'None'}
            note="Current shell profile"
            accent="magenta"
            width={24}
          />
          <MetricCard
            label="Default school"
            value={
              config.defaultSchool
                ? `${config.defaultSchool.name}${config.defaultSchool.region ? ` (${config.defaultSchool.region})` : ''}`
                : 'None'
            }
            note="Current default school"
            accent="cyan"
            width={38}
          />
          <MetricCard
            label="Cache policy"
            value={`${config.cachePolicy.datasetTtlMinutes}m / ${config.cachePolicy.staleIfErrorHours}h / ${config.cachePolicy.maxEntries}`}
            note="TTL / stale / max entries"
            accent="green"
            width={32}
          />
        </Box>
        <InfoLine label="NEIS source" value={config.neisApiKeySource} tone="yellow" />
        <InfoLine
          label="NEIS storage"
          value={describeSecretStorage(config.neisApiKeyStorage, config.neisApiKeySource)}
          tone="yellow"
        />
        {activeProfileHasOwnSchool ? (
          <Callout title="Profile override" accent="yellow">
            The active profile has its own school, so it currently overrides the saved default school.
          </Callout>
        ) : null}
      </Panel>

      <Panel title="Project identity" subtitle="Repository and developer metadata" accent="blue">
        <Box flexWrap="wrap">
          <MetricCard
            label="Project"
            value={KAMPUS_PROJECT_INFO.name}
            note={`${KAMPUS_PROJECT_INFO.description} [read-only]`}
            accent="blue"
            width={38}
          />
          <MetricCard
            label="Developer"
            value={KAMPUS_DEVELOPER_INFO.name}
            note={KAMPUS_DEVELOPER_INFO.email ?? 'Embedded application metadata'}
            accent="magenta"
            width={34}
          />
        </Box>
        <InfoLine label="Repository" value={KAMPUS_PROJECT_INFO.repositoryUrl} tone="cyan" />
        <InfoLine label="Homepage" value={KAMPUS_PROJECT_INFO.homepageUrl} tone="cyan" />
        <InfoLine label="Developer URL" value={KAMPUS_DEVELOPER_INFO.url ?? 'Not set'} tone="magenta" />
        <Text color="gray">This identity is embedded in the app and cannot be changed from user config.</Text>
      </Panel>

      <Panel
        title="Profiles"
        subtitle={
          settingsState.section === 'profiles'
            ? 'Focused pane - Enter activates the selected profile'
            : 'Press Tab to focus'
        }
        accent={settingsState.section === 'profiles' ? 'yellow' : 'cyan'}
      >
        <Box flexDirection="column">
          {config.profiles.length ? (
            config.profiles.map((profile, index) => {
              const focused =
                settingsState.section === 'profiles' && index === settingsState.profileIndex;
              const active = session.activeProfile?.name === profile.name;
              return (
                <ListRow
                  key={profile.name}
                  active={focused}
                  accent="yellow"
                  primary={profile.name}
                  secondary={profile.school?.name}
                  meta={`${profile.grade && profile.classNo ? `${profile.grade}-${profile.classNo}` : 'no class'}${active ? '  active' : ''}`}
                />
              );
            })
          ) : (
            <EmptyState title="Profiles idle" message="No saved profiles yet." />
          )}
          {selectedProfile ? (
            <Text color="gray">
              Selected profile: {selectedProfile.name}
              {selectedProfile.teacherName ? `  teacher: ${selectedProfile.teacherName}` : ''}
            </Text>
          ) : null}
        </Box>
      </Panel>

      <Panel
        title="Recent schools"
        subtitle={
          settingsState.section === 'recent-schools'
            ? 'Focused pane - Enter applies the selected school'
            : 'Press Tab to focus'
        }
        accent={settingsState.section === 'recent-schools' ? 'yellow' : 'cyan'}
      >
        <Box flexDirection="column">
          {session.recentSchools.length ? (
            session.recentSchools.map((school, index) => {
              const focused =
                settingsState.section === 'recent-schools' &&
                index === settingsState.recentSchoolIndex;
              return (
                <ListRow
                  key={`${school.name}-${school.region}-${index}`}
                  active={focused}
                  accent="yellow"
                  primary={school.name}
                  secondary={school.region ? `(${school.region})` : undefined}
                  meta={isSameSchool(session.selectedSchool, school) ? 'current' : school.schoolType}
                />
              );
            })
          ) : (
            <EmptyState title="Recent schools idle" message="No recent schools are saved yet." />
          )}
          {selectedRecentSchool ? (
            <Text color="gray">
              Selected school: {selectedRecentSchool.name}
              {selectedRecentSchool.schoolType ? `  ${selectedRecentSchool.schoolType}` : ''}
            </Text>
          ) : null}
        </Box>
      </Panel>

      <Panel
        title="Actions"
        subtitle={
          settingsState.section === 'actions'
            ? 'Focused pane - Enter runs the selected action'
            : 'Press Tab to focus'
        }
        accent={settingsState.section === 'actions' ? 'yellow' : 'cyan'}
      >
        <Box flexDirection="column">
          {actions.map((action, index) => {
            const focused = settingsState.section === 'actions' && index === settingsState.actionIndex;
            return (
              <ListRow
                key={action.id}
                active={focused}
                accent="yellow"
                primary={action.label}
                meta={action.disabled ? 'disabled' : 'ready'}
                secondary={action.description}
              />
            );
          })}
          {selectedAction ? <Text color="gray">{selectedAction.description}</Text> : null}
        </Box>
      </Panel>

      {dialog ? (
        <Panel title={dialog.title} subtitle="Confirmation required" accent="red">
          <Box flexDirection="column">
            <Text>{dialog.description}</Text>
            <Callout title="Confirm" accent="red">
              {dialog.confirmLabel}
            </Callout>
          </Box>
        </Panel>
      ) : null}
    </Box>
  );
}

export function HelpPage({}: { session?: HumanSessionContext }) {
  return (
    <Box flexDirection="column">
      <Panel title="Workspace identity" subtitle="Project and developer metadata" accent="blue">
        <Box flexDirection="column">
          <InfoLine label="Project" value={KAMPUS_PROJECT_INFO.name} tone="blue" />
          <InfoLine label="Description" value={KAMPUS_PROJECT_INFO.description} tone="blue" />
          <InfoLine label="Repository" value={KAMPUS_PROJECT_INFO.repositoryUrl} tone="cyan" />
          <InfoLine label="Homepage" value={KAMPUS_PROJECT_INFO.homepageUrl} tone="cyan" />
          <InfoLine label="Developer" value={KAMPUS_DEVELOPER_INFO.name} tone="magenta" />
          <InfoLine label="Email" value={KAMPUS_DEVELOPER_INFO.email ?? 'Not set'} tone="magenta" />
          <InfoLine label="Developer URL" value={KAMPUS_DEVELOPER_INFO.url ?? 'Not set'} tone="magenta" />
          <Text color="gray">This metadata is part of the app build and stays read-only for users.</Text>
        </Box>
      </Panel>
      <Panel title="Shell controls" subtitle="Human shell navigation" accent="cyan">
        <Box flexDirection="column">
          <Text>- Left / Right: move between pages</Text>
          <Text>- H / S / T / M / Y / G / P / ?: jump to page</Text>
          <Text>- I: open IME-safe line input on text-entry screens</Text>
          <Text>- Enter: confirm / search / select</Text>
          <Text>- R: refresh current data page</Text>
          <Text>- E: switch into easy mode</Text>
          <Text>- Q or Ctrl+C: exit</Text>
          <Text>- Settings page: Tab switches panes, Up/Down moves, Enter applies</Text>
        </Box>
      </Panel>
      <Panel title="Raw command reminders" subtitle="Automation-safe CLI still available" accent="blue">
        <Box flexDirection="column">
          <Text>- kps school search "&lt;school&gt;"</Text>
          <Text>- kps class week --school "&lt;school&gt;" --grade 3 --class 5</Text>
          <Text>- kps meals today --school "&lt;school&gt;" --date 2026-03-12</Text>
          <Text>- kps neis schedule --school "&lt;school&gt;" --from 2026-03-01 --to 2026-03-31</Text>
          <Text>- kps doctor --live --json</Text>
        </Box>
      </Panel>
      <Callout title="Design rule" accent="yellow">
        All raw commands remain unchanged. This shell is a human-friendly presentation layer over the same engine.
      </Callout>
    </Box>
  );
}

export function EasyModeView({
  easyState,
  session,
  lineInputTarget,
}: {
  easyState: EasyState;
  session: HumanSessionContext | null;
  lineInputTarget?: 'easy-school-query' | 'easy-teacher-name';
}) {
  const selectedSchool = easyState.results[easyState.selectedIndex];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header
        summary={{
          school: session?.selectedSchool?.name ?? 'No school selected',
          profile: session?.activeProfile?.name ?? 'No active profile',
          access: session?.configStatus.neisApiKeyConfigured ? 'official-full' : 'official-limited',
        }}
        subtitle={KAMPUS_TAGLINE}
      />
      <Panel title="Easy Mode" subtitle="Guided setup for first-time interactive use" accent="yellow">
        <StepTrack
          steps={['welcome', 'search', 'class', 'teacher', 'saving']}
          current={easyState.step}
        />
        {selectedSchool ? (
          <Box flexWrap="wrap" marginBottom={1}>
            <MetricCard
              label="School"
              value={selectedSchool.name}
              note={selectedSchool.region ?? 'Region not set'}
              accent="cyan"
              width={38}
            />
            <MetricCard
              label="Class target"
              value={`${easyState.grade}-${easyState.classNo}`}
              note="Editable in class step"
              accent="blue"
              width={24}
            />
            <MetricCard
              label="Teacher"
              value={easyState.teacherName || 'Optional'}
              note="Teacher page shortcut target"
              accent="magenta"
              width={30}
            />
          </Box>
        ) : null}
        {easyState.step === 'welcome' ? (
          <Callout title="Setup flow" accent="cyan">
            <Box flexDirection="column">
              <Text>1. Search your school</Text>
              <Text>2. Choose grade and class</Text>
              <Text>3. Optionally save a teacher name</Text>
              <Text color="gray">Press Enter to start, or Esc to return to human mode.</Text>
            </Box>
          </Callout>
        ) : null}

        {easyState.step === 'search' ? (
          <Box flexDirection="column">
            <InfoLine
              label="School query"
              value={
                lineInputTarget === 'easy-school-query'
                  ? `${easyState.query || 'Type a school name'} [line capture active]`
                  : `${easyState.query || 'Type a school name'} |`
              }
              tone="cyan"
            />
            <Text color="gray">
              Press Enter to search. Press Enter again to confirm the highlighted school. Press I for IME-safe editing.
            </Text>
            {easyState.error ? (
              <Callout title="Search issue" accent="red">
                {easyState.error}
              </Callout>
            ) : null}
            {easyState.loading ? (
              <Callout title="Search in progress" accent="cyan">
                Searching schools...
              </Callout>
            ) : null}
            <Panel title="Search results" subtitle="Choose the highlighted school" accent="yellow">
              <Box flexDirection="column">
                {easyState.results.length ? (
                  easyState.results.slice(0, 8).map((school, index) => (
                    <ListRow
                      key={`${school.name}-${school.region}-${index}`}
                      active={index === easyState.selectedIndex}
                      accent="yellow"
                      primary={school.name}
                      secondary={school.region ? `(${school.region})` : undefined}
                      meta={school.schoolType}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No school results"
                    message="Run a school search to continue the guided setup."
                  />
                )}
              </Box>
            </Panel>
          </Box>
        ) : null}

        {easyState.step === 'class' ? (
          <Callout title="Choose grade and class" accent="blue">
            <Box flexDirection="column">
              <Text>School: {selectedSchool?.name ?? 'None selected'}</Text>
              <Text>Up / Down adjust grade: {easyState.grade}</Text>
              <Text>Left / Right adjust class: {easyState.classNo}</Text>
              <Text color="gray">Press Enter when these values look right.</Text>
            </Box>
          </Callout>
        ) : null}

        {easyState.step === 'teacher' || easyState.step === 'saving' ? (
          <Callout title="Optional teacher shortcut" accent="magenta">
            <Box flexDirection="column">
              <Text>School: {selectedSchool?.name ?? 'None selected'}</Text>
              <Text>Class: {easyState.grade}-{easyState.classNo}</Text>
              <Text>
                Teacher:{' '}
                {lineInputTarget === 'easy-teacher-name'
                  ? `${easyState.teacherName || 'Leave blank to skip'} [line capture active]`
                  : `${easyState.teacherName || 'Leave blank to skip'} |`}
              </Text>
              <Text color="gray">
                Type a teacher name if you want teacher views ready too, then press Enter. Press I for IME-safe editing.
              </Text>
              {easyState.error ? <Text color="red">{easyState.error}</Text> : null}
              {easyState.loading ? (
                <Text color="yellow">Saving your easy mode profile...</Text>
              ) : null}
            </Box>
          </Callout>
        ) : null}
      </Panel>
      <Footer page="help" mode="easy" />
    </Box>
  );
}

function WeekTimetableView({ week }: { week: WeekTimetable }) {
  return (
    <Box flexDirection="column">
      {week.days.map((day) => (
        <Panel
          key={`${day.weekday}-${day.date ?? day.weekdayName}`}
          title={day.weekdayName}
          subtitle={day.date}
          accent="cyan"
        >
          <Box flexDirection="column">
            {day.periods.length ? (
              day.periods.map((period) => (
                <ListRow
                  key={`${day.weekday}-${period.period}`}
                  accent="cyan"
                  leading={`P${period.period}`}
                  primary={period.subject}
                  secondary={period.teacher ? `[${period.teacher}]` : undefined}
                />
              ))
            ) : (
              <Text color="gray">No periods listed.</Text>
            )}
          </Box>
        </Panel>
      ))}
    </Box>
  );
}

function WeeklyMealsView({ week }: { week: WeeklyMeals }) {
  return (
    <Box flexDirection="column">
      {week.days.map((day) => (
        <Panel
          key={day.date}
          title={day.date}
          subtitle={day.weekdayName}
          accent="green"
        >
          <Box flexDirection="column">
            {(day.meals ?? []).length ? (
              (day.meals ?? []).map((meal) => (
                <ListRow
                  key={`${day.date}-${meal.type}`}
                  accent="green"
                  primary={meal.type}
                  secondary={meal.items.slice(0, 4).map((item) => item.name).join(', ')}
                />
              ))
            ) : (
              <Text color="gray">No meals listed.</Text>
            )}
          </Box>
        </Panel>
      ))}
    </Box>
  );
}

function TeacherTimetableView({ timetable }: { timetable: TeacherTimetable }) {
  return (
    <Box flexDirection="column">
      {timetable.days.map((day) => (
        <Panel
          key={`${day.weekday}-${day.date ?? day.weekdayName}`}
          title={day.weekdayName}
          subtitle={day.date}
          accent="magenta"
        >
          <Box flexDirection="column">
            {day.periods.length ? (
              day.periods.map((period) => (
                <ListRow
                  key={`${day.weekday}-${period.period}`}
                  accent="magenta"
                  leading={`P${period.period}`}
                  primary={period.subject}
                  secondary={period.classLabel ? `[${period.classLabel}]` : undefined}
                />
              ))
            ) : (
              <Text color="gray">No periods listed.</Text>
            )}
          </Box>
        </Panel>
      ))}
    </Box>
  );
}

function renderSchoolLabel(name?: string, region?: string): string {
  if (!name) {
    return 'Not set';
  }
  return region ? `${name} (${region})` : name;
}

function isSameSchool(
  left?: { name?: string; region?: string },
  right?: { name?: string; region?: string },
): boolean {
  return Boolean(
    left?.name &&
      right?.name &&
      left.name === right.name &&
      (left.region ?? '') === (right.region ?? ''),
  );
}

