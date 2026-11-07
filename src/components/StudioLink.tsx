import type { ComponentProps } from 'react';
import { useSession } from '../session';
export function StudioLink(props: ComponentProps<'a'>) {
  const { user, studioEnabled } = useSession();
  if (!user || !studioEnabled) return null;
  return <a {...props} href={props.href || '/api/studio'} target="_blank" rel="noreferrer" />;
}
