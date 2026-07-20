import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import { Toaster } from 'react-hot-toast';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <TopNav />
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: { direction: 'rtl', fontFamily: 'Assistant, sans-serif' },
        }}
      />
    </div>
  );
}
