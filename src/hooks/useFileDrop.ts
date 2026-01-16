/**
 * Hook for handling native file drops to create blocks.
 */

import { useState, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Zone } from "@/components/dnd"

// Supported file extensions
const SUPPORTED_EXTENSIONS = [".txt", ".md"]

// Map zone to default block type for file drops
const ZONE_TO_BLOCK_TYPE: Record<Zone, string> = {
  PERMANENT: "SYSTEM",
  STABLE: "NOTE",
  WORKING: "NOTE",
}

interface UseFileDropOptions {
  zone: Zone
  onSuccess?: (fileName: string) => void
  onError?: (error: string) => void
}

export function useFileDrop({ zone, onSuccess, onError }: UseFileDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const createBlock = useMutation(api.blocks.create)

  const isValidFile = useCallback((file: File): boolean => {
    return SUPPORTED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if dragging files
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const validFiles = files.filter(isValidFile)

      if (validFiles.length === 0) {
        onError?.("Only .txt and .md files are supported")
        return
      }

      for (const file of validFiles) {
        try {
          const content = await file.text()
          const blockType = ZONE_TO_BLOCK_TYPE[zone]

          await createBlock({
            content,
            type: blockType,
            zone,
          })

          onSuccess?.(file.name)
        } catch (error) {
          onError?.(`Failed to add file: ${file.name}`)
        }
      }
    },
    [zone, createBlock, isValidFile, onSuccess, onError]
  )

  return {
    isDragOver,
    dropProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  }
}
