/**
 * Streaming self-talk detector.
 *
 * Scans text deltas for role-marker tokens that indicate the model
 * is hallucinating conversation turns. Handles markers split across
 * multiple streaming chunks via a rolling tail buffer.
 *
 * Detected markers:
 * - XML role tags: </assistant>, <assistant>, <user>, </user>, <system>, </system>
 * - Legacy training markers: ###Human:, ###Assistant:, \n\nHuman:, \n\nAssistant:
 * - Our new format markers (when appearing mid-response): \n\nUSER:\n
 */

const ROLE_MARKERS = [
  "</assistant>",
  "<assistant>",
  "</user>",
  "<user>",
  "</system>",
  "<system>",
  "###Human:",
  "###Assistant:",
  "\n\nHuman:",
  "\n\nAssistant:",
  "\n\nUSER:\n",
] as const

// Longest marker is "</assistant>" = 12 chars
const MAX_MARKER_LENGTH = Math.max(...ROLE_MARKERS.map((m) => m.length))

export interface SelfTalkDetection {
  /** The marker that was detected */
  marker: string
  /** Text before the marker (from the current chunk) */
  cleanText: string
  /** Position in the total accumulated text where the marker starts */
  position: number
}

export class SelfTalkDetector {
  private tailBuffer = ""
  private totalLength = 0

  /**
   * Feed a new text chunk to the detector.
   *
   * @returns Detection info if a role marker was found, null otherwise
   */
  feed(chunk: string): SelfTalkDetection | null {
    // Combine tail buffer with new chunk for cross-boundary detection
    const searchWindow = this.tailBuffer + chunk

    for (const marker of ROLE_MARKERS) {
      const idx = searchWindow.indexOf(marker)
      if (idx !== -1) {
        // Calculate position in total text
        const positionInTotal = this.totalLength - this.tailBuffer.length + idx

        // cleanText: the part of the current chunk before the marker
        const markerStartInChunk = idx - this.tailBuffer.length
        const cleanText = markerStartInChunk > 0 ? chunk.slice(0, markerStartInChunk) : ""

        return { marker, cleanText, position: positionInTotal }
      }
    }

    // Update state
    this.totalLength += chunk.length
    // Keep only enough tail to catch markers split across chunks
    this.tailBuffer = searchWindow.slice(-MAX_MARKER_LENGTH)

    return null
  }
}
