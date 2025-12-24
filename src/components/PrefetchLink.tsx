import React, { useCallback } from 'react';
import { Link, LinkProps } from 'react-router-dom';

/**
 * Next.js inspired PrefetchLink
 * 
 * Automatically triggers resource prefetching when the user hovers over a link.
 * This works by dynamically calling the import() function for the target route.
 */

interface PrefetchLinkProps extends Omit<LinkProps, 'prefetch'> {
    onPrefetch?: () => Promise<any>;
}

export const PrefetchLink: React.FC<PrefetchLinkProps> = ({
    onPrefetch,
    onMouseEnter,
    children,
    ...props
}) => {
    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        // Execute prefetch if provided
        if (onPrefetch) {
            console.log(`[Prefetch] Preloading resources for ${props.to}`);
            onPrefetch().catch(err => console.error('[Prefetch] Error preloading:', err));
        }

        // Call original onMouseEnter if present
        if (onMouseEnter) {
            onMouseEnter(e);
        }
    }, [onPrefetch, props.to, onMouseEnter]);

    return (
        <Link {...props} onMouseEnter={handleMouseEnter}>
            {children}
        </Link>
    );
};
