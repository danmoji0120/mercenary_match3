import { useEffect, useState } from 'react';

export function CharacterPortrait({ src, alt, className, eager = false }: { src?: string; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <span className={`character-portrait-fallback${className ? ` ${className}` : ''}`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}><span aria-hidden="true">◆</span></span>;
  return <img className={className} src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>;
}
