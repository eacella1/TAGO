import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage/MainPage';
import LoginPage from './pages/LoginPage/LoginPage';
import SignupPage from './pages/SignupPage/SignupPage';
import MyPage from './pages/mypage/Mypage';
import SchedulePage from './pages/SchedulePage/SchedulePage';
import ReservationPage from './pages/ReservationPage/ReservationPage';
import DialogHost from './components/Dialog/DialogHost';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/reservation" element={<ReservationPage />} />
      </Routes>
      <DialogHost />
    </BrowserRouter>
  );
}
