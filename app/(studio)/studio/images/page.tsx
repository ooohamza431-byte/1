import type { Metadata } from 'next';
import { ImageStudio } from '@/components/studio/image-studio';

export const metadata: Metadata = {
  title: 'Image Studio',
  description: 'Generate images with Pollinations — free, keyless and never proxied through the server.',
};

export default function ImagesPage() {
  return <ImageStudio />;
}
