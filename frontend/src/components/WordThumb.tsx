/** A square cut-out of the picture around one object, using the box SAM found. */
export function WordThumb({
  image,
  box,
  className = '',
}: {
  image: string
  box: [number, number, number, number]
  className?: string
}) {
  const [x1, y1, x2, y2] = box
  // A little room around the object, then a square that holds all of it.
  const size = Math.min(1, Math.max(x2 - x1, y2 - y1) * 1.25)
  const left = Math.min(Math.max((x1 + x2) / 2 - size / 2, 0), 1 - size)
  const top = Math.min(Math.max((y1 + y2) / 2 - size / 2, 0), 1 - size)
  const position = (offset: number) => (size >= 1 ? 50 : (offset / (1 - size)) * 100)
  return (
    <div
      aria-hidden="true"
      className={`aspect-square bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url("${image}")`,
        backgroundSize: `${100 / size}%`,
        backgroundPosition: `${position(left)}% ${position(top)}%`,
      }}
    />
  )
}
