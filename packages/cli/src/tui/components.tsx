import { Box, Text } from 'ink';
import type { DataStatus, ProviderWarning } from '@kampus/core';
import type { ReactNode } from 'react';
import { getCompactWordmarkLines } from './logo.js';
import { HUMAN_PAGES, type HumanPageId, type InteractiveMode } from './types.js';
import {
  PAGE_SHORTCUTS,
  accentColor,
  accentGlyph,
  accessTone,
  pageTone,
  type AccentTone,
} from './theme.js';

export function Header({
  summary,
  subtitle,
}: {
  summary: { school: string; profile: string; access: string };
  subtitle: string;
}) {
  return (
    <Panel title="Kampus Ops Deck" subtitle={subtitle} accent="blue">
      <Box flexDirection="column">
        {getCompactWordmarkLines().map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
        <Text color="gray">
          Enterprise-style terminal workspace for school operations, daily schedules, meals, and provider diagnostics.
        </Text>
        <Box flexWrap="wrap" marginTop={1}>
          <MetricCard
            label="School"
            value={summary.school}
            note="Current default school context"
            accent="cyan"
            width={34}
          />
          <MetricCard
            label="Profile"
            value={summary.profile}
            note="Active saved shell profile"
            accent="magenta"
            width={32}
          />
          <MetricCard
            label="Access"
            value={summary.access}
            note="Official provider mode"
            accent={accessTone(summary.access)}
            width={24}
          />
        </Box>
        <Text color="gray">
          Use page shortcuts to jump instantly. Raw commands and MCP behavior remain unchanged.
        </Text>
      </Box>
    </Panel>
  );
}

export function NoticeBanner({
  notice,
}: {
  notice?: { title: string; message: string; accent: AccentTone } | null;
}) {
  if (!notice) {
    return null;
  }

  return (
    <Panel title={notice.title} subtitle="Latest shell event" accent={notice.accent}>
      <Text>{notice.message}</Text>
    </Panel>
  );
}

export function FocusBanner({
  focus,
}: {
  focus: { title: string; description: string; accent: AccentTone };
}) {
  return (
    <Panel title={`Input focus: ${focus.title}`} subtitle="Current keyboard target" accent={focus.accent}>
      <Text>{focus.description}</Text>
    </Panel>
  );
}

export function Navigation({ pageIndex }: { pageIndex: number }) {
  return (
    <Panel title="Navigation" subtitle="Direct page access" accent="cyan">
      <Box flexWrap="wrap">
        {HUMAN_PAGES.map((page, index) => {
          const active = index === pageIndex;
          const tone = pageTone(page.id);
          return (
            <Box key={page.id} marginRight={1} marginBottom={1}>
              <Text
                color={active ? 'black' : accentColor(tone)}
                backgroundColor={active ? accentColor(tone) : undefined}
              >
                {active
                  ? ` ${PAGE_SHORTCUTS[page.id]} ${page.label} `
                  : `[${PAGE_SHORTCUTS[page.id]} ${page.label}]`}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Panel>
  );
}

export function Panel({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent: AccentTone;
  children: ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accentColor(accent)}
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Text color={accentColor(accent)}>
        {accentGlyph(accent)} {title.toUpperCase()}
        {subtitle ? <Text color="gray">  {subtitle}</Text> : null}
      </Text>
      <Box marginTop={0} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

export function MetricCard({
  label,
  value,
  note,
  accent,
  width,
}: {
  label: string;
  value: string;
  note?: string;
  accent: AccentTone;
  width?: number;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accentColor(accent)}
      paddingX={1}
      marginRight={1}
      marginBottom={1}
      width={width}
    >
      <Text color={accentColor(accent)}>{label.toUpperCase()}</Text>
      <Text>{value}</Text>
      {note ? <Text color="gray">{note}</Text> : null}
    </Box>
  );
}

export function Callout({
  title,
  accent,
  children,
}: {
  title: string;
  accent: AccentTone;
  children: ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accentColor(accent)}
      paddingX={1}
      marginTop={1}
    >
      <Text color={accentColor(accent)}>{title}</Text>
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </Box>
  );
}

export function InfoLine({
  label,
  value,
  tone = 'cyan',
}: {
  label: string;
  value: string;
  tone?: AccentTone;
}) {
  return (
    <Text>
      <Text color={accentColor(tone)}>{label.padEnd(14, ' ')}</Text>
      <Text color="gray"> : </Text>
      {value}
    </Text>
  );
}

export function ListRow({
  active,
  accent,
  primary,
  secondary,
  meta,
  leading,
}: {
  active?: boolean;
  accent: AccentTone;
  primary: string;
  secondary?: string;
  meta?: string;
  leading?: string;
}) {
  return (
    <Text
      color={active ? 'black' : undefined}
      backgroundColor={active ? accentColor(accent) : undefined}
    >
      {active ? '>' : ' '} {leading ? `${leading} ` : ''}{primary}
      {secondary ? <Text color={active ? 'black' : 'gray'}>{`  ${secondary}`}</Text> : null}
      {meta ? <Text color={active ? 'black' : accentColor(accent)}>{`  ${meta}`}</Text> : null}
    </Text>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Callout title={title} accent="yellow">
      <Text color="gray">{message}</Text>
    </Callout>
  );
}

export function StatusBadge({
  text,
  tone,
}: {
  text: string;
  tone: AccentTone | 'gray';
}) {
  const background = tone === 'gray' ? 'gray' : accentColor(tone);
  const foreground = tone === 'gray' ? 'white' : 'black';
  return (
    <Text color={foreground} backgroundColor={background}>
      {` ${text} `}
    </Text>
  );
}

export function DataStatusSummary({
  label,
  status,
  warnings,
}: {
  label: string;
  status?: DataStatus;
  warnings?: ProviderWarning[];
}) {
  const mergedWarnings = mergeWarnings(status?.warnings, warnings);
  if (!status && !mergedWarnings.length) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text color="cyan">{label}</Text>
        <Text color="gray">  </Text>
        {status ? (
          <>
            <StatusBadge text={status.accessMode} tone={accessTone(status.accessMode)} />
            <Text> </Text>
            <StatusBadge
              text={status.complete ? 'complete' : 'partial'}
              tone={status.complete ? 'green' : 'yellow'}
            />
            {status.sourceProviders.length ? (
              <Text color="gray">  sources: {status.sourceProviders.join(', ')}</Text>
            ) : null}
          </>
        ) : (
          <StatusBadge text="no status metadata" tone="gray" />
        )}
      </Text>
      <WarningList warnings={mergedWarnings} />
    </Box>
  );
}

export function IssueList({
  issues,
  title = 'Issue ledger',
}: {
  issues?: Array<{ section: string; message: string }>;
  title?: string;
}) {
  if (!issues?.length) {
    return null;
  }

  return (
    <Callout title={title} accent="yellow">
      <Box flexDirection="column">
        {issues.map((issue) => (
          <Text key={`${issue.section}:${issue.message}`} color="yellow">
            - {issue.section}: {issue.message}
          </Text>
        ))}
      </Box>
    </Callout>
  );
}

export function WarningList({ warnings }: { warnings?: ProviderWarning[] }) {
  if (!warnings?.length) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {warnings.map((warning) => (
        <Text key={`${warning.provider}:${warning.code}:${warning.message}`} color="yellow">
          - {warning.provider}/{warning.code}: {warning.message}
        </Text>
      ))}
    </Box>
  );
}

export function StepTrack({
  steps,
  current,
}: {
  steps: string[];
  current: string;
}) {
  const currentIndex = Math.max(0, steps.indexOf(current));
  return (
    <Box flexWrap="wrap" marginBottom={1}>
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending';
        const tone = state === 'done' ? 'green' : state === 'current' ? 'cyan' : 'gray';
        return (
          <Box key={step} marginRight={1} marginBottom={1}>
            <StatusBadge
              text={`${index + 1} ${step}`}
              tone={tone === 'gray' ? 'gray' : tone}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export function Footer({ page, mode }: { page: HumanPageId; mode: InteractiveMode }) {
  if (mode === 'easy') {
    return (
      <KeyHintBar
        hints={[
          ['I', 'ime-safe edit'],
          ['Enter', 'confirm'],
          ['Esc', 'back'],
          ['Ctrl+C', 'exit'],
        ]}
      />
    );
  }

  if (page === 'schools') {
    return (
      <KeyHintBar
        hints={[
          ['Type', 'search'],
          ['I', 'ime-safe edit'],
          ['Enter', 'query/select'],
          ['Up/Down', 'move'],
          ['1-9', 'recent'],
          ['H/S/T/M/Y/G/P/?', 'jump'],
          ['Q', 'quit'],
        ]}
      />
    );
  }

  if (page === 'settings') {
    return (
      <KeyHintBar
        hints={[
          ['Up/Down', 'move'],
          ['Tab', 'switch pane'],
          ['Enter', 'apply'],
          ['Esc', 'cancel confirm'],
          ['H/S/T/M/Y/G/P/?', 'jump'],
        ]}
      />
    );
  }

  return (
    <KeyHintBar
      hints={[
        ['Left/Right', 'pages'],
        ['H/S/T/M/Y/G/P/?', 'jump'],
        ['R', 'refresh'],
        ['E', 'easy'],
        ['Q', 'quit'],
        ['Ctrl+C', 'exit'],
      ]}
    />
  );
}

function KeyHintBar({
  hints,
}: {
  hints: Array<[string, string]>;
}) {
  return (
    <Box flexWrap="wrap">
      {hints.map(([key, label]) => (
        <Box key={`${key}:${label}`} marginRight={1}>
          <Text color="black" backgroundColor="white">
            {` ${key} `}
          </Text>
          <Text color="gray"> {label}</Text>
        </Box>
      ))}
    </Box>
  );
}

function mergeWarnings(
  fromStatus?: ProviderWarning[],
  fromValue?: ProviderWarning[],
): ProviderWarning[] {
  const merged = [...(fromStatus ?? []), ...(fromValue ?? [])];
  return merged.filter((warning, index, values) => {
    return (
      values.findIndex(
        (candidate) =>
          candidate.provider === warning.provider &&
          candidate.code === warning.code &&
          candidate.message === warning.message,
      ) === index
    );
  });
}
