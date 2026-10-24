export default function TeamLogo({ src, alt = '', size = 28 }) {
  if (!src) return <span className="logo logo-empty" style={{ width: size, height: size }} />
  return (
    <img
      className="logo"
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
    />
  )
}
