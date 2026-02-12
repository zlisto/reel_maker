import React, { useState, useEffect } from 'react';

/**
 * Animates dots cycling: . → .. → ... → (repeat)
 * Use with prefix for "Generating" etc.
 */
export default function AnimatedDots({ prefix = '' }) {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return <span>{prefix}{dots}</span>;
}
