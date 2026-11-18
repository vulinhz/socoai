import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  BookOpen,
  Camera,
  ChevronDown,
  Compass,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { heroLearningWorldImg } from '../lib/assets';
import { usePageSeo } from '../lib/seo';
import { SocoMascot } from './SocoMascot';
import { PWAInstallButton } from './PwaControls';

const FAQ_ITEMS = [
  {
    q: 'Vì sao Gia sư SOCO không đưa ngay đáp án khi bé hỏi bài?',
    a: 'Theo phương pháp Socratic, việc chép đáp án sẵn khiến trẻ nhanh quên và lệ thuộc. SOCO chia bài toán thành các câu hỏi nhỏ vừa sức lớp 1–5 và cung cấp tối đa 3 cấp độ gợi ý để bé tự khám phá ra lời giải và ghi nhớ bản chất lâu dài.',
  },
  {
    q: 'Kho Tri thức có bám sát chương trình Tiểu học Việt Nam không?',
    a: 'Có. Nội dung Toán học và Tiếng Việt được biên soạn theo định hướng Chương trình Giáo dục Phổ thông 2018 từ Lớp 1 đến Lớp 5 (100+ bài học cùng ví dụ minh họa và câu hỏi tương tác nhanh), có thể lưu đọc ngoại tuyến.',
  },
  {
    q: 'Thông tin cá nhân và ảnh chụp bài tập của bé được bảo vệ như thế nào?',
    a: 'Tài khoản học sinh không yêu cầu email hay số điện thoại, tuân thủ Điều 20 Nghị định 13/2023/NĐ-CP. Lịch sử trò chuyện tự động xóa theo cấu hình lưu trữ định kỳ và phụ huynh nắm mã liên kết để giám sát, rút lại đồng ý bất cứ lúc nào.',
  },
  {
    q: 'Bé Lớp 1–2 chưa đọc thạo có sử dụng được không?',
    a: 'Hệ thống tự động bật Chế độ Lớp 1–2 với chữ và nút bấm lớn hơn, nội dung ngắn gọn dễ hiểu và tính năng tự đọc to câu trả lời của SOCO bằng giọng tiếng Việt.',
  },
];

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  usePageSeo({
    title: 'SOCRATES KIDS AI — Gia sư AI Socratic cho Học sinh Tiểu học Việt Nam (Lớp 1–5)',
    description:
      'Think. Explore. Learn. Nền tảng gia sư AI Socratic giúp học sinh lớp 1–5 tự tư duy và hiểu bản chất kiến thức, kèm Kho Tri thức GDPT 2018 và 10 dạng trò chơi tương tác an toàn.',
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'SOCRATES KIDS AI',
      applicationCategory: 'EducationalApplication',
      inLanguage: 'vi',
      operatingSystem: 'Web',
      description: 'Gia sư AI Socratic an toàn dành cho học sinh tiểu học Việt Nam từ lớp 1 đến lớp 5.',
    },
  });

  return (
    <div className="min-h-screen bg-[#F7FBFF] flex flex-col text-slate-900">
      {/* 3-zone Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">SOCRATES KIDS AI</span>
          </Link>

          <nav aria-label="Điều hướng giới thiệu" className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-700">
            <a href="#phuong-phap" className="hover:text-sky-700 whitespace-nowrap">
              Phương pháp Socratic
            </a>
            <a href="#tinh-nang" className="hover:text-sky-700 whitespace-nowrap">
              3 Tính năng chính
            </a>
            <a href="#an-toan" className="hover:text-sky-700 whitespace-nowrap">
              An toàn Trẻ em
            </a>
            <a href="#faq" className="hover:text-sky-700 whitespace-nowrap">
              Hỏi đáp
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>
            <Link
              to="/dang-nhap"
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogIn className="w-4 h-4 text-sky-700" aria-hidden="true" />
              <span>Đăng nhập</span>
            </Link>
            <Link
              to="/dang-ky"
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>Đăng ký</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 lg:py-14">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                <span>Think. Explore. Learn. · Dành cho Học sinh Tiểu học Lớp 1–5</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight text-balance">
                Cùng bé tự khám phá tri thức thay vì chép đáp án có sẵn
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                Gia sư AI Socratic đồng hành cùng học sinh Việt Nam từ lớp 1 đến lớp 5 bằng câu hỏi gợi mở vừa sức, quét ảnh đề bài thông minh, Kho Tri thức GDPT 2018 và 10 dạng trò chơi tư duy.
              </p>

              <SocoMascot
                emotion="happy"
                size="md"
                speech="Xin chào! Mình là SOCO. Mình không giải hộ ngay đâu, nhưng mình sẽ cùng em tìm ra cách giải thật dễ hiểu!"
              />

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/dang-ky"
                  className="px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-base inline-flex items-center gap-2 shadow-xs"
                >
                  <UserPlus className="w-5 h-5" aria-hidden="true" />
                  <span>Đăng ký tài khoản miễn phí</span>
                </Link>
                <Link
                  to="/dang-nhap"
                  className="px-6 py-3.5 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-950 font-bold text-base inline-flex items-center gap-2"
                >
                  <LogIn className="w-5 h-5 text-orange-600" aria-hidden="true" />
                  <span>Đã có tài khoản? Đăng nhập</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden border border-slate-200 bg-sky-50 shadow-sm aspect-4/3">
                <img
                  src={heroLearningWorldImg}
                  alt="Minh họa thế giới học tập khám phá tri thức SOCRATES KIDS AI dành cho học sinh tiểu học"
                  width={1200}
                  height={900}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs text-slate-500 text-center mt-2.5">
                Phân hóa ngôn ngữ &amp; giao diện riêng cho Lớp 1–2, Lớp 3 và Lớp 4–5
              </p>
            </div>
          </div>
        </section>

        {/* Socratic Explanation for Parents */}
        <section id="phuong-phap" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 space-y-6">
            <div className="max-w-3xl">
              <span className="text-xs font-extrabold text-sky-700 uppercase tracking-wider">Dành cho Phụ huynh &amp; Thầy cô</span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Phương pháp Socratic giúp trẻ rèn tư duy thật sự như thế nào?
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
                Thay vì trả ngay kết quả cuối cùng như công cụ tìm kiếm thông thường, SOCO dẫn dắt trẻ đi qua 3 nhịp sư phạm chuẩn mực để kiến thức thực sự thuộc về trẻ:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-sky-200 space-y-2">
                <div className="text-xs font-extrabold text-sky-700">BƯỚC 1 · GỢI MỞ NHẸ</div>
                <h3 className="font-display text-lg font-extrabold text-slate-900">Đặt câu hỏi vừa tầm</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Phân tích chỗ bé đang vướng (tính nhầm, quên quy đồng, hiểu sai đề) và hỏi 1 câu ngắn giúp bé tự nhận ra dữ kiện quan trọng.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-sky-200 space-y-2">
                <div className="text-xs font-extrabold text-orange-700">BƯỚC 2 · GỢI Ý 3 CẤP ĐỘ</div>
                <h3 className="font-display text-lg font-extrabold text-slate-900">Hỗ trợ tăng dần theo mức hiểu</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cấp 1 nhắc kiến thức nền, Cấp 2 chỉ hướng làm, Cấp 3 đưa ví dụ tương tự. Chỉ mở giải mẫu khi bé đã nỗ lực qua đủ bước.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-sky-200 space-y-2">
                <div className="text-xs font-extrabold text-emerald-700">BƯỚC 3 · ĐỘNG VIÊN &amp; ÔN CỦNG CỐ</div>
                <h3 className="font-display text-lg font-extrabold text-slate-900">Tạo bài tương tự để khắc sâu</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Khi bé tự giải đúng, SOCO khen ngợi đúng điểm tiến bộ và đề xuất một thử thách tương tự để kiểm chứng bé đã hiểu bản chất.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Core Features */}
        <section id="tinh-nang" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <span className="text-xs font-extrabold text-sky-700 uppercase tracking-wider">Hệ sinh thái Học tập Toàn diện</span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              3 Tính năng Cốt lõi cho Học sinh Lớp 1–5
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <article className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Camera className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-extrabold text-slate-900">Gia sư AI &amp; Quét ảnh Đề bài</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Chụp hoặc tải ảnh vở viết tay, sách giáo khoa; kéo chọn đúng vùng bài tập và chỉnh sửa trước khi hỏi SOCO. Hỗ trợ đọc to tiếng Việt cho Lớp 1–2.
              </p>
            </article>

            <article className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <BookOpen className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-extrabold text-slate-900">Kho Tri thức 100+ bài GDPT 2018</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hệ thống bài giảng Toán, Tiếng Việt, Tự nhiên – Xã hội, Khoa học theo từng lớp 1–5 với mục tiêu rõ ràng, ví dụ trực quan và lưu ngoại tuyến (PWA).
              </p>
            </article>

            <article className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-extrabold text-slate-900">Play &amp; Learn + Báo cáo Phụ huynh</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                10 dạng trò chơi rèn tư duy (nối cặp, sắp xếp, ghép chữ, lật thẻ, truyện tương tác...) tự động cập nhật hồ sơ năng lực và báo cáo tuần PDF/CSV.
              </p>
            </article>
          </div>
        </section>

        {/* Child Safety Commitments */}
        <section id="an-toan" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Tuân thủ Nghị định 13/2023/NĐ-CP &amp; Điều 20 Bảo vệ Dữ liệu Trẻ em</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
                Cam kết An toàn Tuyệt đối cho Học sinh Tiểu học
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-700 pt-1">
                <li className="flex items-start gap-2">
                  <HeartHandshake className="w-4 h-4 text-emerald-700 shrink-0 mt-1" aria-hidden="true" />
                  <span>Không thu thập email, số điện thoại hay vị trí của trẻ em.</span>
                </li>
                <li className="flex items-start gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0 mt-1" aria-hidden="true" />
                  <span>Mọi bài tập từ AI đều phải qua giáo viên duyệt trước khi xuất bản.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-1" aria-hidden="true" />
                  <span>Phụ huynh nắm mã liên kết bảo hộ và xem báo cáo tuần minh bạch.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-1" aria-hidden="true" />
                  <span>Tự động xóa lịch sử hội thoại quá hạn định kỳ (mặc định 90 ngày).</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              <Link
                to="/chinh-sach-du-lieu-tre-em"
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold text-center"
              >
                Đọc Chính sách Dữ liệu Trẻ em
              </Link>
              <Link
                to="/chinh-sach-bao-mat"
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-900 text-sm font-bold text-center"
              >
                Xem Chính sách Bảo mật
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-14">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 space-y-5">
            <h2 className="font-display text-2xl font-extrabold text-slate-900">Câu hỏi Thường gặp (FAQ)</h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item, idx) => {
                const expanded = openFaq === idx;
                return (
                  <div key={item.q} className="rounded-2xl border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenFaq(expanded ? null : idx)}
                      className="w-full px-5 py-4 text-left font-bold text-sm sm:text-base text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {expanded && (
                      <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="text-center sm:text-left">
            <strong className="text-slate-900">SOCRATES KIDS AI</strong> · Think. Explore. Learn. · Vận hành bởi <strong>[TÊN ĐƠN VỊ]</strong>
          </div>
          <nav aria-label="Liên kết pháp lý chân trang" className="flex flex-wrap items-center justify-center gap-4 font-semibold">
            <Link to="/chinh-sach-bao-mat" className="hover:text-sky-700">Chính sách bảo mật</Link>
            <Link to="/dieu-khoan-su-dung" className="hover:text-sky-700">Điều khoản sử dụng</Link>
            <Link to="/chinh-sach-du-lieu-tre-em" className="hover:text-sky-700">Chính sách dữ liệu trẻ em</Link>
            <Link to="/lien-he" className="hover:text-sky-700">Liên hệ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
