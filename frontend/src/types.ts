export type ProviderInfo = {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: Eip1193Provider;
};

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type CaseResult = {
  case_id: string;
  state: string;
  outcome: string;
  observed_repository: string;
  observed_tag: string;
  observed_commit_id: string;
  source_subdirectory: string;
  evidence_digest: string;
  retry_count: number;
};

export type ContractCase = CaseResult & {
  owner: string;
  ecosystem: string;
  package_name: string;
  version: string;
  registry_url: string;
  repository_owner: string;
  repository_name: string;
  release_url: string;
  expected_commit_id: string;
};
