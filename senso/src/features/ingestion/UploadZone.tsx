import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  onFiles: (files: File[]) => void
  uploading: boolean
  disabled?: boolean
}

export function UploadZone({ onFiles, uploading, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.tiff,.bmp,.webp"

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return (
    <div
      className={[
        "rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onFiles(files)
          // Reset so the same file(s) can be re-selected if needed
          e.target.value = ""
        }}
      />
      <p className="text-sm font-medium text-foreground">
        {uploading ? "Uploading..." : "Drop files here or click to select"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Supports: CSV, XLSX, PDF, images (max 20 MB)
      </p>
      {!uploading && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 pointer-events-none"
          tabIndex={-1}
        >
          Choose file
        </Button>
      )}
    </div>
  )
}
