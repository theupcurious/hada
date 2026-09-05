-- Atomically claim a workflow across manual and cron workers.
ALTER TABLE public.scheduled_tasks
  ADD COLUMN IF NOT EXISTS execution_token uuid,
  ADD COLUMN IF NOT EXISTS execution_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_workflow_execution(
  task_id uuid, owner_id uuid, claim_token uuid, expected_last_run timestamptz
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH claimed AS (
    UPDATE scheduled_tasks
       SET execution_token = claim_token, execution_started_at = now()
     WHERE id = task_id AND user_id = owner_id
       AND last_run_at IS NOT DISTINCT FROM expected_last_run
       AND (execution_token IS NULL OR execution_started_at < now() - interval '10 minutes')
    RETURNING id
  ) SELECT EXISTS(SELECT 1 FROM claimed);
$$;
REVOKE ALL ON FUNCTION public.claim_workflow_execution(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workflow_execution(uuid, uuid, uuid, timestamptz) TO service_role;
