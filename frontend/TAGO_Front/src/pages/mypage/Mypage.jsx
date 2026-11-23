import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../Api/client';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import QuickMenu from '../../components/QuickMenu/QuickMenu';
import RouteLine from '../../components/RouteLine/RouteLine';
import { dialog, notify } from '../../components/Dialog/dialogService';
import useWishStore from '../../store/useWishStore';
import './MyPage.css';

// 날짜/시간 포맷 변환 헬퍼 함수
const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: '', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const raw = String(dateStr);
      return {
        date: raw.length >= 10 ? raw.slice(0, 10) : raw,
        time: raw.length >= 16 ? raw.slice(11, 16) : '',
      };
    }
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const day = days[d.getDay()];
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    return {
      date: `${yyyy}. ${mm}. ${dd} (${day})`,
      time: `${hh}:${min}`,
    };
  } catch {
    return { date: String(dateStr), time: '' };
  }
};

// 좌석 등급 코드 -> 표시 이름 (백엔드는 현재 STANDARD 만 내려준다)
const GRADE_LABEL = { STANDARD: '일반실', FIRST: '특실', PREMIUM: '특실' };

// 백엔드 MyTicketResponseDTO -> 화면 표시용 데이터 변환
const parseTicket = (item) => {
  const dep = formatDateTime(item.depplandtime);
  const arr = formatDateTime(item.arrplandtime);
  const rawPrice = Number(item.totalPrice || 0);
  return {
    reservationSeq: item.reservationSeq,
    reservationSeqs: [item.reservationSeq],
    scheduleSeq: item.scheduleSeq,
    carNo: item.carNo,
    trainName: `${item.vehiclekndnm || 'KTX'} ${item.trainno || ''}`.trim(),
    trainType: item.vehiclekndnm || 'KTX',
    depDate: dep.date,
    depStation: item.depStation || '출발역',
    arrStation: item.arrStation || '도착역',
    depTime: dep.time || '00:00',
    arrTime: arr.time || '00:00',
    car: item.carNo ? `${item.carNo}호차` : '일반',
    seatNo: item.seatNo || '-',
    seat: item.seatNo || '-',
    seatGrade: GRADE_LABEL[item.seatGrade] || item.seatGrade || '어른',
    passenger: `${GRADE_LABEL[item.seatGrade] || item.seatGrade || '어른'} 1명`,
    rawPrice,
    price: `${rawPrice.toLocaleString()}원`,
    hasRealTicketNumber: Boolean(item.ticketNumber),
    ticketNumber: item.ticketNumber || `T-${String(item.reservationSeq || '').padStart(8, '0')}`,
    status: item.status || 'CONFIRMED',
  };
};

// 동일한 스케줄·호차·상태의 승차권을 하나로 묶어 좌석 목록/인원/금액 합산
const groupTickets = (rawList) => {
  const map = new Map();

  for (const raw of rawList) {
    const t = parseTicket(raw);
    const key = `${t.scheduleSeq ?? 'none'}_${t.carNo ?? 'none'}_${t.status}`;

    if (!map.has(key)) {
      map.set(key, {
        ...t,
        seats: [t.seatNo],
      });
    } else {
      const group = map.get(key);
      group.reservationSeqs.push(t.reservationSeq);
      if (t.seatNo && t.seatNo !== '-' && !group.seats.includes(t.seatNo)) {
        group.seats.push(t.seatNo);
      }
      group.rawPrice += t.rawPrice;
      if (!group.hasRealTicketNumber && t.hasRealTicketNumber) {
        group.hasRealTicketNumber = true;
        group.ticketNumber = t.ticketNumber;
      }
    }
  }

  return Array.from(map.values()).map((group) => ({
    ...group,
    seat: group.seats.join(', '),
    passenger: `${group.seatGrade} ${group.reservationSeqs.length}명`,
    price: `${group.rawPrice.toLocaleString()}원`,
  }));
};

const MENU_ITEMS = [
  { key: 'ticket', label: '승차권' },
  { key: 'favorites', label: '찜한 열차' },
  { key: 'profile', label: '내 정보' },
];

const TICKET_FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'ACTIVE', label: '이용 예정' },
  { key: 'CANCELLED', label: '취소·반환' },
];

// 상태는 색만으로 구분하지 않고 글자를 함께 쓴다
const STATUS = {
  CANCELLED: { label: '반환완료', cls: 'is-cancelled' },
  HELD: { label: '결제대기', cls: 'is-held' },
  CONFIRMED: { label: '발권완료', cls: 'is-ok' },
};
const statusOf = (status) => STATUS[status] || STATUS.CONFIRMED;

const IconChevron = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export default function MyPage() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('ticket');

  // 실제 예매 목록 및 선택된 승차권 상태
  const [ticketList, setTicketList] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'CANCELLED'
  const [selectedTicketIndex, setSelectedTicketIndex] = useState(0);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  // 백엔드에서 내 예매 승차권 목록 조회
  const fetchMyTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      // GET /api/reservation/me
      const res = await client.get('/reservation/me');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const grouped = groupTickets(res.data);
        setTicketList(grouped);
        setSelectedTicketIndex(0);
      } else {
        setTicketList([]);
      }
    } catch (err) {
      console.error('승차권 목록 조회 실패:', err);
      setTicketList([]);
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  const filteredTickets = ticketList.filter((t) => {
    if (ticketFilter === 'ACTIVE') return t.status !== 'CANCELLED';
    if (ticketFilter === 'CANCELLED') return t.status === 'CANCELLED';
    return true;
  });

  const countByFilter = (key) => ticketList.filter((t) => {
    if (key === 'ACTIVE') return t.status !== 'CANCELLED';
    if (key === 'CANCELLED') return t.status === 'CANCELLED';
    return true;
  }).length;

  // 승차권 예매 취소
  const handleCancelTicket = async (ticket) => {
    if (!ticket) return;
    const ok = await dialog.confirm(`[${ticket.trainName} / 좌석: ${ticket.car} ${ticket.seat}] 예매를 취소하시겠습니까?`, {
      title: '승차권 반환',
      confirmLabel: '예매 취소하기',
      cancelLabel: '닫기',
      danger: true,
    });
    if (!ok) return;

    try {
      const rawSeqs = ticket.reservationSeqs?.length ? ticket.reservationSeqs : [ticket.reservationSeq];
      const seqs = Array.from(new Set(rawSeqs.filter(Boolean)));
      await Promise.all(seqs.map((seq) => client.post(`/reservation/${seq}/cancel`)));
      notify.success('승차권 예매가 정상적으로 취소되었습니다.');
      await fetchMyTickets();
    } catch (error) {
      console.error('승차권 예매 취소 에러:', error);
      dialog.alert(error.response?.data?.message || '승차권 예매 취소에 실패했습니다. 다시 시도해 주세요.', {
        title: '취소 실패',
        tone: 'error',
      });
    }
  };

  const handleShowReceipt = (ticket) => {
    dialog.alert(
      `승차권: ${ticket.ticketNumber}\n열차: ${ticket.trainName}\n구간: ${ticket.depStation} -> ${ticket.arrStation}\n좌석: ${ticket.car} ${ticket.seat}\n결제금액: ${ticket.price}`,
      { title: '영수증 정보' }
    );
  };

  // 찜하기 중앙 스토어 연동 (메인·시각표·마이페이지 공통)
  const { wishList, fetchWishList, toggleWish } = useWishStore();
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    fetchWishList();
  }, [fetchWishList]);

  // 백엔드에서 받아온 찜 목록 번호(wishList)에 해당하는 실제 스케줄 상세 정보를 조회해 마이페이지에 표시
  useEffect(() => {
    if (!Array.isArray(wishList) || wishList.length === 0) {
      setFavorites([]);
      return;
    }

    const calcDuration = (depStr, arrStr) => {
      if (!depStr || !arrStr) return '-';
      const diffMs = new Date(arrStr).getTime() - new Date(depStr).getTime();
      if (isNaN(diffMs) || diffMs <= 0) return '-';
      const totalMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
    };

    const loadFavoriteSchedules = async () => {
      try {
        const results = await Promise.all(
          wishList.map((seq) =>
            client
              .get(`/schedule/${seq}`)
              .then((res) => res.data)
              .catch((err) => {
                console.error('찜한 열차 상세 조회 실패:', seq, err);
                return null;
              })
          )
        );

        const parsed = results
          .filter((item) => item && item.schedule_seq != null)
          .map((item) => {
            const dep = formatDateTime(item.depplandtime);
            const arr = formatDateTime(item.arrplandtime);
            const type = item.vehiclekndnm || 'KTX';
            return {
              id: item.schedule_seq,
              scheduleSeq: item.schedule_seq,
              name: `${type} ${item.trainno || ''}`.trim(),
              type,
              depDate: dep.date,
              depTime: dep.time || '00:00',
              arrTime: arr.time || '00:00',
              duration: calcDuration(item.depplandtime, item.arrplandtime),
              depStation: item.depStationName || item.depplacename || '출발역',
              arrStation: item.arrStationName || item.arrplacename || '도착역',
              price: item.standard_price ? Number(item.standard_price).toLocaleString() : '59,800',
            };
          });

        setFavorites(parsed);
      } catch (err) {
        console.error('찜 목록 스케줄 변환 실패:', err);
      }
    };

    loadFavoriteSchedules();
  }, [wishList]);

  // 마이페이지 찜 삭제 클릭 시 백엔드 DELETE 및 화면 즉시 갱신
  const handleRemoveFavorite = (scheduleSeq) => {
    toggleWish(scheduleSeq);
  };

  const handleBookFavoriteTrain = (fav) => {
    navigate('/reservation', {
      state: {
        scheduleSeq: fav.scheduleSeq,
        trainName: fav.name,
        trainType: fav.type || 'KTX',
        depTime: fav.depTime,
        arrTime: fav.arrTime,
        duration: fav.duration,
        depStation: fav.depStation || '서울',
        arrStation: fav.arrStation || '부산',
        depDate: fav.depDate || '',
        passenger: '어른 1명',
        seatType: '일반실',
        price: fav.price,
      }
    });
  };

  const [originalUserInfo, setOriginalUserInfo] = useState({
    userId: '',
    name: '',
    email: '',
    phone: '',
    postcode: '',
    address: '',
    detailAddress: '',
  });

  const [editUserInfo, setEditUserInfo] = useState({ ...originalUserInfo });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      dialog.alert('로그인이 필요한 서비스입니다.', { title: '로그인 필요' }).then(() => navigate('/login'));
      return;
    }

    const loadData = async () => {
      try {
        // 1. 프로필 조회
        const profileRes = await client.get('/member/mypage');
        if (profileRes.data) {
          const data = profileRes.data;
          const loadedInfo = {
            userId: data.id || data.member_id || '',
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            postcode: data.zipcode || '',
            address: data.address1 || '',
            detailAddress: data.address2 || '',
          };
          setOriginalUserInfo(loadedInfo);
          setEditUserInfo(loadedInfo);
        }

        // 2. 승차권 목록 조회
        const ticketRes = await client.get('/reservation/me');
        if (Array.isArray(ticketRes.data) && ticketRes.data.length > 0) {
          const grouped = groupTickets(ticketRes.data);
          setTicketList(grouped);
          setSelectedTicketIndex(0);
        } else {
          setTicketList([]);
        }
      } catch (error) {
        console.error('마이페이지 초기 데이터 로딩 실패:', error);
        if (error.response?.status === 401) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('id');
          dialog.alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', { title: '세션 만료', tone: 'warning' }).then(() => navigate('/login'));
        }
      } finally {
        setIsLoadingTickets(false);
      }
    };

    loadData();
  }, [navigate]);

  const [emailAuthStep, setEmailAuthStep] = useState(1);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleUserInfoChange = (e) => {
    const { name, value } = e.target;
    setEditUserInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleStartEdit = () => {
    setEditUserInfo({ ...originalUserInfo });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditUserInfo({ ...originalUserInfo });
    setIsEditing(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      // PUT /api/member
      await client.put('/member', {
        name: editUserInfo.name,
        email: editUserInfo.email,
        phone: editUserInfo.phone.replace(/[^0-9]/g, ''),
        zipcode: editUserInfo.postcode,
        address1: editUserInfo.address,
        address2: editUserInfo.detailAddress,
      });

      setOriginalUserInfo({ ...editUserInfo });
      setIsEditing(false);
      notify.success('회원 정보가 성공적으로 수정되었습니다.');
    } catch (error) {
      console.error('회원 정보 수정 에러:', error);
      notify.error('회원 정보 수정에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const handleOpenKakaoPostcode = () => {
    if (!isEditing) return;

    if (window.daum && window.daum.Postcode) {
      new window.daum.Postcode({
        oncomplete: (data) => {
          const fullAddress = data.roadAddress || data.jibunAddress;
          let extraAddress = '';

          if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
            extraAddress += data.bname;
          }
          if (data.buildingName !== '' && data.apartment === 'Y') {
            extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
          }

          const finalAddress = extraAddress !== '' ? `${fullAddress} (${extraAddress})` : fullAddress;

          setEditUserInfo((prev) => ({
            ...prev,
            postcode: data.zonecode,
            address: finalAddress,
          }));

          const detailInput = document.getElementById('editDetailAddressInput');
          if (detailInput) {
            detailInput.focus();
          }
        },
      }).open();
    } else {
      notify.warning('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleSendEmailAuth = async () => {
    try {
      const res = await client.post('/member/password/send-code');
      notify.success(res.data?.message || `회원님의 가입 이메일(${originalUserInfo.email})로 6자리 인증번호가 발송되었습니다.`);
      setEmailAuthStep(2);
    } catch (err) {
      console.error(err);
      notify.error(err.response?.data?.message || err.response?.data || '인증번호 발송에 실패했습니다.');
    }
  };

  const handleVerifyEmailCode = async () => {
    if (!authCodeInput || authCodeInput.trim().length !== 6) {
      notify.warning('6자리 인증번호를 정확히 입력해 주세요.');
      return;
    }
    try {
      const res = await client.post('/member/password/verify', { code: authCodeInput.trim() });
      notify.success(res.data?.message || '이메일 본인인증이 완료되었습니다. 새로운 비밀번호를 설정해 주세요.');
      setIsEmailVerified(true);
      setEmailAuthStep(3);
    } catch (err) {
      console.error(err);
      notify.error(err.response?.data?.message || err.response?.data || '인증번호가 일치하지 않거나 만료되었습니다.');
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!isEmailVerified) {
      notify.warning('먼저 이메일 인증을 완료해 주세요.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      notify.warning('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 8) {
      notify.warning('비밀번호는 최소 8자리 이상이어야 합니다.');
      return;
    }

    try {
      const res = await client.put('/member/password', { newPassword });
      notify.success(res.data?.message || '비밀번호가 성공적으로 변경되었습니다. 다음 로그인부터 적용됩니다.');
      setNewPassword('');
      setConfirmNewPassword('');
      setAuthCodeInput('');
      setIsEmailVerified(false);
      setEmailAuthStep(1);
    } catch (err) {
      console.error(err);
      notify.error(err.response?.data?.message || err.response?.data || '비밀번호 변경에 실패했습니다.');
    }
  };

  return (
    <div className="mypage-wrapper">
      <Header isLoggedIn={true} showTopBar={true} />

      <main className="mypage-container">
        <div className="mypage-head">
          <h1 className="ui-title">마이페이지</h1>
          <p className="mypage-who">
            <strong>{originalUserInfo.name ? `${originalUserInfo.name} 님` : '회원 님'}</strong>
            <span>@{originalUserInfo.userId || 'user'}</span>
          </p>
        </div>

        <div className="ui-segment mypage-tabs" role="tablist" aria-label="마이페이지 메뉴">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`mypage-tab-${item.key}`}
              aria-selected={activeMenu === item.key}
              aria-controls="mypage-panel"
              onClick={() => setActiveMenu(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section id="mypage-panel" role="tabpanel" aria-labelledby={`mypage-tab-${activeMenu}`} className="mypage-panel">
          {activeMenu === 'ticket' && (
            <>
              <div className="ui-segment tk-filter" role="group" aria-label="승차권 상태 필터">
                {TICKET_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={ticketFilter === f.key}
                    onClick={() => { setTicketFilter(f.key); setSelectedTicketIndex(0); }}
                  >
                    {f.label} <span className="num">{countByFilter(f.key)}</span>
                  </button>
                ))}
              </div>

              {isLoadingTickets ? (
                <p className="mypage-empty" role="status">승차권 정보를 불러오는 중입니다.</p>
              ) : filteredTickets.length > 0 ? (
                <ul className="tk-list">
                  {filteredTickets.map((ticket, idx) => {
                    const st = statusOf(ticket.status);
                    const open = selectedTicketIndex === idx;
                    const bodyId = `tk-body-${idx}`;
                    return (
                      <li key={`${ticket.reservationSeq}_${idx}`} className={`tk ${st.cls}`}>
                        <button
                          type="button"
                          className="tk__head"
                          aria-expanded={open}
                          aria-controls={bodyId}
                          onClick={() => setSelectedTicketIndex(open ? -1 : idx)}
                        >
                          <span className="tk__top">
                            <span className="tk__date num">{ticket.depDate}</span>
                            <span className={`tk__status ${st.cls}`}>{st.label}</span>
                            <IconChevron className="tk__chev" />
                          </span>

                          <span className="tk__seat">
                            <span className="tk__car"><b className="num">{ticket.carNo ?? '-'}</b>호차</span>
                            <b className="tk__no num">{ticket.seat}</b>
                          </span>

                          <RouteLine
                            size="sm"
                            depTime={ticket.depTime}
                            arrTime={ticket.arrTime}
                            depStation={ticket.depStation}
                            arrStation={ticket.arrStation}
                          />

                          <span className="tk__train">
                            <span className="num">{ticket.trainName}</span>
                            <span className="num">{ticket.passenger} · {ticket.price}</span>
                          </span>
                        </button>

                        {open && (
                          <div className="tk__body" id={bodyId}>
                            <dl className="kv">
                              <div className="kv__row">
                                <dt>승차권 번호</dt>
                                <dd className="num">{ticket.ticketNumber}</dd>
                              </div>
                              <div className="kv__row">
                                <dt>매수</dt>
                                <dd className="num">{ticket.reservationSeqs.length}매</dd>
                              </div>
                            </dl>
                            <div className="tk__actions">
                              <button type="button" className="ui-btn ui-btn--neutral" onClick={() => handleShowReceipt(ticket)}>
                                영수증 조회
                              </button>
                              {ticket.status === 'CANCELLED' ? (
                                <button type="button" className="ui-btn ui-btn--neutral" disabled>
                                  반환 완료
                                </button>
                              ) : (
                                <button type="button" className="ui-btn ui-btn--danger" onClick={() => handleCancelTicket(ticket)}>
                                  승차권 반환
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mypage-empty">
                  <p>{ticketFilter === 'CANCELLED' ? '반환한 승차권이 없습니다.' : '발권된 승차권이 없습니다.'}</p>
                  <button type="button" className="ui-btn ui-btn--weak" onClick={() => navigate('/')}>
                    승차권 예매하기
                  </button>
                </div>
              )}
            </>
          )}

          {activeMenu === 'favorites' && (
            <>
              {favorites.length > 0 ? (
                <ul className="fv-list">
                  {favorites.map((train) => (
                    <li key={train.id || train.name} className="fv">
                      <RouteLine
                        size="sm"
                        depTime={train.depTime}
                        arrTime={train.arrTime}
                        depStation={train.depStation || '서울'}
                        arrStation={train.arrStation || '부산'}
                        duration={train.duration}
                      />
                      <p className="fv__meta">
                        <span className="num">{train.name}</span>
                        <span className="num">일반실 {train.price}원</span>
                      </p>
                      <div className="fv__actions">
                        <button
                          type="button"
                          className="ui-btn ui-btn--neutral"
                          onClick={() => handleRemoveFavorite(train.scheduleSeq || train.id)}
                        >
                          찜 삭제
                        </button>
                        <button type="button" className="ui-btn" onClick={() => handleBookFavoriteTrain(train)}>
                          좌석 선택
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mypage-empty">
                  <p>찜한 열차가 없습니다.</p>
                  <button type="button" className="ui-btn ui-btn--weak" onClick={() => navigate('/schedule')}>
                    운행 시간표 보기
                  </button>
                </div>
              )}
            </>
          )}

          {activeMenu === 'profile' && (
            <>
              <div className="pf">
                <div className="pf__head">
                  <h2 className="ui-heading">내 정보</h2>
                  {!isEditing && (
                    <button type="button" className="ui-btn ui-btn--weak ui-btn--sm" onClick={handleStartEdit}>
                      수정
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <dl className="kv">
                    <div className="kv__row"><dt>아이디</dt><dd>{originalUserInfo.userId}</dd></div>
                    <div className="kv__row"><dt>이름</dt><dd>{originalUserInfo.name}</dd></div>
                    <div className="kv__row"><dt>이메일</dt><dd>{originalUserInfo.email}</dd></div>
                    <div className="kv__row"><dt>휴대전화</dt><dd className="num">{originalUserInfo.phone}</dd></div>
                    <div className="kv__row">
                      <dt>주소</dt>
                      <dd>
                        {originalUserInfo.postcode && <span className="num">({originalUserInfo.postcode}) </span>}
                        {originalUserInfo.address} {originalUserInfo.detailAddress}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <form onSubmit={handleSaveProfile} className="pf-form">
                    <div className="ui-field">
                      <label className="ui-field__label" htmlFor="pf-id">아이디</label>
                      <input id="pf-id" className="ui-field__control" type="text" value={editUserInfo.userId} disabled />
                      <span className="ui-field__help">아이디는 변경할 수 없습니다.</span>
                    </div>
                    <div className="ui-field">
                      <label className="ui-field__label" htmlFor="pf-name">이름</label>
                      <input id="pf-name" className="ui-field__control" type="text" name="name" value={editUserInfo.name} onChange={handleUserInfoChange} required />
                    </div>
                    <div className="ui-field">
                      <label className="ui-field__label" htmlFor="pf-email">이메일</label>
                      <input id="pf-email" className="ui-field__control" type="email" name="email" value={editUserInfo.email} onChange={handleUserInfoChange} required />
                    </div>
                    <div className="ui-field">
                      <label className="ui-field__label" htmlFor="pf-phone">휴대전화 번호</label>
                      <input id="pf-phone" className="ui-field__control" type="tel" name="phone" inputMode="tel" value={editUserInfo.phone} onChange={handleUserInfoChange} required />
                    </div>
                    <div className="ui-field">
                      <label className="ui-field__label" htmlFor="pf-postcode">주소</label>
                      <div className="field-row">
                        <input id="pf-postcode" className="ui-field__control" type="text" name="postcode" value={editUserInfo.postcode} readOnly placeholder="우편번호" />
                        <button type="button" className="ui-btn ui-btn--neutral" onClick={handleOpenKakaoPostcode}>
                          우편번호 찾기
                        </button>
                      </div>
                      <input className="ui-field__control" type="text" name="address" value={editUserInfo.address} readOnly placeholder="기본 주소" aria-label="기본 주소" />
                      <input className="ui-field__control" type="text" id="editDetailAddressInput" name="detailAddress" value={editUserInfo.detailAddress} onChange={handleUserInfoChange} placeholder="상세 주소를 입력하세요" aria-label="상세 주소" />
                    </div>
                    <div className="pf-actions">
                      <button type="button" className="ui-btn ui-btn--neutral" onClick={handleCancelEdit}>취소</button>
                      <button type="submit" className="ui-btn">수정 완료</button>
                    </div>
                  </form>
                )}
              </div>

              <div className="pf">
                <div className="pf__head">
                  <h2 className="ui-heading">비밀번호 변경</h2>
                </div>
                <p className="pf__lead">등록된 이메일로 본인 인증을 한 뒤 변경할 수 있습니다.</p>

                <form onSubmit={handleSavePassword} className="pf-form">
                  <div className="ui-field">
                    <label className="ui-field__label" htmlFor="pw-email">인증 이메일</label>
                    <div className="field-row">
                      <input id="pw-email" className="ui-field__control" type="email" value={originalUserInfo.email} disabled />
                      <button
                        type="button"
                        className="ui-btn ui-btn--neutral"
                        onClick={handleSendEmailAuth}
                        disabled={isEmailVerified || !originalUserInfo.email}
                      >
                        {isEmailVerified ? '인증 완료' : emailAuthStep === 1 ? '인증번호 받기' : '다시 받기'}
                      </button>
                    </div>
                  </div>

                  {emailAuthStep >= 2 && !isEmailVerified && (
                    <div className="ui-field">
                      <label className="ui-field__label" htmlFor="pw-code">인증번호 6자리</label>
                      <div className="field-row">
                        <input
                          id="pw-code"
                          className="ui-field__control num"
                          type="text"
                          inputMode="numeric"
                          maxLength="6"
                          placeholder="6자리 숫자"
                          value={authCodeInput}
                          onChange={(e) => setAuthCodeInput(e.target.value)}
                        />
                        <button type="button" className="ui-btn" onClick={handleVerifyEmailCode}>확인</button>
                      </div>
                      <span className="ui-field__help">이메일 수신함에서 인증번호를 확인해 주세요.</span>
                    </div>
                  )}

                  {isEmailVerified && (
                    <>
                      <p className="pf-verified"><IconCheck /> 이메일 본인 인증이 완료되었습니다.</p>
                      <div className="ui-field">
                        <label className="ui-field__label" htmlFor="pw-new">새 비밀번호</label>
                        <input id="pw-new" className="ui-field__control" type="password" autoComplete="new-password" placeholder="8자리 이상" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                      </div>
                      <div className="ui-field">
                        <label className="ui-field__label" htmlFor="pw-new2">새 비밀번호 확인</label>
                        <input id="pw-new2" className="ui-field__control" type="password" autoComplete="new-password" placeholder="한 번 더 입력" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                      </div>
                      <button type="submit" className="ui-btn ui-btn--lg ui-btn--block">비밀번호 변경</button>
                    </>
                  )}
                </form>
              </div>
            </>
          )}
        </section>
      </main>

      <QuickMenu />
      <Footer />
    </div>
  );
}
