import MapView from '@/components/map/MapView';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      {/* 
        This will render the full-screen map. 
        Later we will overlay the Report Button and Risk Legend here. 
      */}
      <MapView />
    </main>
  );
}