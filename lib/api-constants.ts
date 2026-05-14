// ============================================================================
// Constants shared between API routes and their tests. Exporting them avoids
// the "magic number" duplication where the test asserts e.g. `< 1024 bytes`
// while the route hardcodes `1024`.
// ============================================================================

/** Writing: refuse essays shorter than this — protects OpenAI quota / user limit
 *  from being burned on a non-gradable submission. */
export const WRITING_ABSOLUTE_MIN_WORDS = 50;

/** Writing IELTS task minimums (used only in the AI prompt, not as a hard reject). */
export const WRITING_TASK1_MIN_WORDS = 150;
export const WRITING_TASK2_MIN_WORDS = 250;

/** Speaking: minimum audio blob size — anything smaller is "empty mic" noise. */
export const SPEAKING_MIN_AUDIO_BYTES = 1024;

/** Speaking: minimum words in the Whisper transcript to attempt grading. */
export const SPEAKING_MIN_TRANSCRIPT_WORDS = 5;
