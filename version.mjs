import { readFileSync } from 'node:fs';

export function parseVersion(input) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.([1-9]\d*))?$/.exec(input);
  if (!match || match.slice(1).filter(Boolean).some(part => !Number.isSafeInteger(Number(part)))) {
    throw new Error('版本号须为三段数字，或追加大于零的第四段独立更新编号');
  }
  const studioVersion = match.slice(1, 4).join('.');
  const revision = match[4] ? Number(match[4]) : 0;
  return {
    version: input,
    studioVersion,
    revision,
    // npm requires SemVer. Public releases and images always use the exact VERSION.
    packageVersion: revision ? `${studioVersion}+revision.${revision}` : studioVersion,
  };
}

export const versionInfo = parseVersion(readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim());
