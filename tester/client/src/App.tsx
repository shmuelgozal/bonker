import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UnitsList from './pages/UnitsList';
import BunkersList from './pages/BunkersList';
import BunkerDetail from './pages/BunkerDetail';
import AmmoTypes from './pages/AmmoTypes';
import BunkerInventoryAdd from './pages/BunkerInventoryAdd';
import BunkerCountNew from './pages/BunkerCountNew';
import BunkerIssuanceNew from './pages/BunkerIssuanceNew';
import BunkerStandard from './pages/BunkerStandard';
import IssuanceDetail from './pages/IssuanceDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/units" element={<UnitsList />} />
          <Route path="/bunkers" element={<BunkersList />} />
          <Route path="/bunkers/:id" element={<BunkerDetail />} />
          <Route path="/bunkers/:id/inventory/add" element={<BunkerInventoryAdd />} />
          <Route path="/bunkers/:id/count/new" element={<BunkerCountNew />} />
          <Route path="/bunkers/:id/issuance/new" element={<BunkerIssuanceNew />} />
          <Route path="/bunkers/:id/issuances/:issuanceId" element={<IssuanceDetail />} />
          <Route path="/bunkers/:id/standard" element={<BunkerStandard />} />
          <Route path="/ammo-types" element={<AmmoTypes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
