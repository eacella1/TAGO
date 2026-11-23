import { create } from 'zustand';
import client from '../pages/Api/client';
import { dialog } from '../components/Dialog/dialogService';

const useWishStore = create((set, get) => ({
  // 내가 찜한 일정 번호 목록 (예: [1, 5, 12])
  wishList: [],

  // 1. 찜 목록 가져오기
  fetchWishList: () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      set({ wishList: [] });
      return;
    }

    client.get('wishlist')
      .then((res) => {
        set({ wishList: Array.isArray(res.data) ? res.data : [] });
      })
      .catch((err) => {
        console.error('찜 목록 로드 실패:', err);
      });
  },

  // 2. 찜 토글 (추가/삭제)
  toggleWish: async (scheduleSeq) => {
    if (!scheduleSeq) return;

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    // 비로그인 상태에서 하트 클릭 시 친절한 로그인 안내 후 이동!
    if (!token) {
      await dialog.alert('로그인이 필요한 서비스입니다.\n로그인 페이지로 이동합니다.', { tone: 'warning' });
      window.location.href = '/login';
      return;
    }

    const { wishList, fetchWishList } = get();
    const isWished = wishList.includes(scheduleSeq);

    const apiCall = isWished
      ? client.delete(`wishlist/${scheduleSeq}`)
      : client.post(`wishlist/${scheduleSeq}`);

    apiCall
      .then(() => {
        fetchWishList(); // ⭐️ 찜 등록/삭제 즉시 3개 페이지(메인·시각표·마이페이지) 동시 최신화!
      })
      .catch(async (err) => {
        if (err.response?.status === 401) {
          await dialog.alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', { tone: 'warning' });
          window.location.href = '/login';
        } else {
          console.error('찜 처리 실패:', err);
        }
      });
  },

  // 3. 해당 열차가 찜 상태인지 확인 (true / false)
  isWish: (scheduleSeq) => get().wishList.includes(scheduleSeq),
}));

export default useWishStore;
