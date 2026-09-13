-- Run with Perfetto trace_processor query -f this-file frames.pftrace.
-- Join the Chrome content frame to its actual display-frame completion.
-- These records can omit Chrome presentations; gaps are diagnostic, not proof
-- of a visible freeze. Compare browser feedback or synchronized motion. Native
-- timestamps use BOOTTIME; dumpsys uses MONOTONIC, so compare intervals.
WITH presents AS (
 SELECT DISTINCT d.ts+d.dur AS present
 FROM actual_frame_timeline_slice a
 JOIN actual_frame_timeline_slice d
 ON d.display_frame_token=a.display_frame_token
 AND d.surface_frame_token IS NULL
 WHERE a.layer_name LIKE '%ChromeChildSurface%'
), gaps AS (
 SELECT present,(present-LAG(present) OVER (ORDER BY present))/1e6 AS gap_ms
 FROM presents
)
SELECT * FROM gaps WHERE gap_ms>67 ORDER BY gap_ms DESC;
