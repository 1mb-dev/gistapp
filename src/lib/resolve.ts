import type {
  ResolvedAnswers,
  ResolvedDataSource,
  ResolvedDataSourceKind,
  UserAnswers,
} from './types';

/** Resolve a raw `dataSource` answer into its discriminated form.
 *  `'unsure'` and missing values fold to `'no-external'` (conservative default).
 *  This is the single source of truth for the resolution rule. */
export function resolveDataSource(answers: Partial<UserAnswers>): ResolvedDataSource {
  const raw = answers.dataSource;
  const kind = mapRawToKind(raw);
  return { kind };
}

/** Resolve a full `UserAnswers` into the `ResolvedAnswers` shape used by the spec
 *  generator. Only `dataSource` is rewritten; all other fields pass through unchanged. */
export function resolveAnswers(raw: UserAnswers): ResolvedAnswers {
  return { ...raw, dataSource: resolveDataSource(raw) };
}

function mapRawToKind(raw: UserAnswers['dataSource'] | undefined): ResolvedDataSourceKind {
  if (!raw || raw === 'unsure' || raw === 'no-external') return 'no-external';
  if (raw === 'user-content') return 'user-content';
  return raw;
}
