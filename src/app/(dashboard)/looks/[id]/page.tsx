import LookDetailClient from './LookDetailClient';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function LookDetailPage() {
  return <LookDetailClient />;
}
