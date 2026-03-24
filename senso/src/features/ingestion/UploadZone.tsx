import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  onFile: (file: File) => void
  uploading: boolean
  disabled?: boolean
}

export function UploadZone({ onFile, uploading, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.tiff,.bmp,.webp"

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
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
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
      <p className="text-sm font-medium text-foreground">
        {uploading ? "Uploading..." : "Drop a file here or click to select"}
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
