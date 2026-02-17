import GarmentDetailClient from './GarmentDetailClient';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function GarmentDetailPage() {
  return <GarmentDetailClient />;
}
