'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useId } from 'react';

interface SectionProps {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}

export default function Section({ title, seeAllHref, seeAllLabel = 'See all', children }: SectionProps) {
  const id = useId();
  return (
    <section className="ln-section" aria-labelledby={id}>
      <div className="ln-section-head">
        <h2 id={id} className="ln-section-title">{title}</h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="ln-see-all">
            {seeAllLabel} <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
