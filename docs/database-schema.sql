CREATE TABLE repositories (
  id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_url TEXT,
  default_branch TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE analysis_runs (
  id UUID PRIMARY KEY,
  repository_id UUID NOT NULL REFERENCES repositories(id),
  status TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE TABLE impact_reports (
  id UUID PRIMARY KEY,
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id),
  changed_node_id TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  report_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
