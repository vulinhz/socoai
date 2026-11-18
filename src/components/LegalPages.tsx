import React from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Baby, Compass, FileText, Mail, ShieldCheck } from 'lucide-react';
import { usePageSeo } from '../lib/seo';

export type LegalPageKind = 'privacy' | 'terms' | 'children' | 'contact';

const PAGE_SEO: Record<LegalPageKind, { title: string; description: string; path: string }> = {
  privacy: {
    title: 'Chính sách bảo mật · SOCRATES KIDS AI',
    description: 'Thông tin minh bạch về dữ liệu thu thập, xử lý qua Gemini AI, thời gian lưu trữ và quyền của người dùng theo Nghị định 13/2023/NĐ-CP.',
    path: '/chinh-sach-bao-mat',
  },
  terms: {
    title: 'Điều khoản sử dụng · SOCRATES KIDS AI',
    description: 'Quy định sử dụng nền tảng gia sư AI Socratic dành cho học sinh tiểu học lớp 1–5, giáo viên và phụ huynh.',
    path: '/dieu-khoan-su-dung',
  },
  children: {
    title: 'Chính sách dữ liệu trẻ em · SOCRATES KIDS AI',
    description: 'Cam kết bảo vệ dữ liệu cá nhân trẻ em theo Điều 20 Nghị định 13/2023/NĐ-CP và cơ chế bảo hộ từ phụ huynh.',
    path: '/chinh-sach-du-lieu-tre-em',
  },
  contact: {
    title: 'Liên hệ & Yêu cầu dữ liệu · SOCRATES KIDS AI',
    description: 'Thông tin liên hệ hỗ trợ phụ huynh, nhà trường và tiếp nhận yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu cá nhân.',
    path: '/lien-he',
  },
};

export function LegalPageView({ kind }: { kind: LegalPageKind }) {
  const seo = PAGE_SEO[kind];
  usePageSeo(seo);

  const navLinks: Array<{ kind: LegalPageKind; to: string; label: string }> = [
    { kind: 'privacy', to: '/chinh-sach-bao-mat', label: 'Chính sách bảo mật' },
    { kind: 'terms', to: '/dieu-khoan-su-dung', label: 'Điều khoản sử dụng' },
    { kind: 'children', to: '/chinh-sach-du-lieu-tre-em', label: 'Chính sách dữ liệu trẻ em' },
    { kind: 'contact', to: '/lien-he', label: 'Liên hệ' },
  ];

  return (
    <div className="min-h-screen bg-[#F7FBFF] flex flex-col">
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 text-slate-900 font-display font-extrabold text-base">
            <span className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
              <Compass className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>SOCRATES KIDS AI</span>
          </Link>
          <Link
            to="/"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <nav aria-label="Điều hướng tài liệu pháp lý" className="flex flex-wrap gap-2">
          {navLinks.map((item) => (
            <Link
              key={item.kind}
              to={item.to}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                kind === item.kind
                  ? 'bg-sky-600 border-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-sky-400'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <article className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 space-y-6 text-slate-800 leading-relaxed">
          {kind === 'privacy' && (
            <>
              <header className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-700">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Tuân thủ Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                  Chính sách Bảo mật Dữ liệu Cá nhân
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn vị vận hành: <strong>[TÊN ĐƠN VỊ]</strong> · Liên hệ bảo vệ dữ liệu: <strong>[EMAIL LIÊN HỆ]</strong>
                </p>
              </header>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">1. Phạm vi và Dữ liệu hệ thống thực sự thu thập</h2>
                <p className="text-sm">
                  Nhằm cung cấp chức năng gia sư AI Socratic và quản lý tiến độ học tập tiểu học (Lớp 1–5), <strong>[TÊN ĐƠN VỊ]</strong> chỉ thu thập những dữ liệu cần thiết tối thiểu:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1.5 text-slate-700">
                  <li>
                    <strong>Thông tin tài khoản:</strong> Tên tài khoản (username), tên hiển thị, vai trò (học sinh/giáo viên/phụ huynh), lớp học (1–5), mật khẩu được băm một chiều an toàn (bcrypt). Riêng tài khoản học sinh <em>không bắt buộc</em> cung cấp email hoặc số điện thoại.
                  </li>
                  <li>
                    <strong>Dữ liệu học tập &amp; tương tác:</strong> Nội dung hội thoại hỏi–đáp cùng SOCO, chủ đề đang học, điểm số bài tập/trò chơi, mức độ nắm vững kiến thức, lỗi thường gặp và thời lượng học tập.
                  </li>
                  <li>
                    <strong>Ảnh chụp đề bài (khi học sinh chủ động sử dụng tính năng Quét ảnh):</strong> Ảnh chụp/tải lên được nén trên thiết bị và chuyển qua máy chủ để nhận dạng văn bản đề bài (OCR). Hệ thống không lưu ảnh gốc vĩnh viễn trên máy chủ sau khi đã trích xuất văn bản đề bài vào phiên học.
                  </li>
                  <li>
                    <strong>Nhật ký an toàn AI:</strong> Ghi nhận thời điểm, mã lỗi kỹ thuật và cờ cảnh báo an toàn nội dung nhằm bảo vệ trẻ em khỏi nội dung không phù hợp.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">2. Dữ liệu gửi tới bên xử lý AI (Google Gemini API)</h2>
                <p className="text-sm text-slate-700">
                  Khi người dùng chủ động gửi câu hỏi cho Gia sư SOCO, quét ảnh đề bài, hoặc khi giáo viên/phụ huynh dùng tính năng gợi ý sư phạm AI, máy chủ ứng dụng sẽ chuyển nội dung câu hỏi, ngữ cảnh môn/lớp (không kèm mật khẩu hay thông tin định danh nhạy cảm như email) hoặc hình ảnh đề bài tới dịch vụ <strong>Google Gemini API</strong> qua kết nối mã hóa HTTPS để tạo phản hồi Socratic tức thời. Hệ thống không bán dữ liệu và không dùng dữ liệu học sinh cho mục đích quảng cáo.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">3. Thời gian lưu trữ và Cơ chế tự động xóa</h2>
                <p className="text-sm text-slate-700">
                  Lịch sử hội thoại với Gia sư SOCO được lưu trữ phục vụ ôn tập theo cấu hình quản trị hệ thống (mặc định <strong>90 ngày</strong> kể từ lần cập nhật cuối của phiên học). Sau thời hạn này, hệ thống tự động xóa các phiên hội thoại và tin nhắn quá hạn. Hồ sơ tài khoản và tiến độ học tập được lưu cho tới khi phụ huynh hoặc chủ tài khoản yêu cầu xóa.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">4. Quyền của chủ thể dữ liệu theo Nghị định 13/2023/NĐ-CP</h2>
                <p className="text-sm text-slate-700">
                  Theo quy định tại <strong>Nghị định 13/2023/NĐ-CP</strong>, phụ huynh, học sinh, giáo viên có đầy đủ các quyền: được biết về hoạt động xử lý dữ liệu; quyền đồng ý hoặc rút lại sự đồng ý; quyền truy cập, xem, chỉnh sửa hồ sơ; quyền yêu cầu xóa dữ liệu hoặc hạn chế xử lý dữ liệu bằng cách gửi yêu cầu tới <strong>[EMAIL LIÊN HỆ]</strong>.
                </p>
              </section>
            </>
          )}

          {kind === 'terms' && (
            <>
              <header className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-700">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span>Quy định sử dụng nền tảng giáo dục</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                  Điều khoản Sử dụng Dịch vụ
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn vị cung cấp: <strong>[TÊN ĐƠN VỊ]</strong> · Hỗ trợ: <strong>[EMAIL LIÊN HỆ]</strong>
                </p>
              </header>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">1. Mục đích giáo dục Socratic</h2>
                <p className="text-sm text-slate-700">
                  SOCRATES KIDS AI được thiết kế hỗ trợ học sinh tiểu học Việt Nam (Lớp 1–5) rèn tư duy tự giải quyết vấn đề thông qua câu hỏi gợi mở, không thay thế hoàn toàn sự hướng dẫn của thầy cô và cha mẹ. Học sinh cần trung thực khi làm bài tập và không sử dụng hệ thống cho mục đích gian lận thi cử.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">2. Tài khoản &amp; Trách nhiệm người dùng</h2>
                <ul className="list-disc list-inside text-sm space-y-1.5 text-slate-700">
                  <li>Người dùng cần bảo mật mật khẩu và không chia sẻ tài khoản quản trị hoặc tài khoản giáo viên cho người không có thẩm quyền.</li>
                  <li>Không tải lên hình ảnh chứa thông tin cá nhân nhạy cảm (CMND/CCCD, số điện thoại, địa chỉ nhà riêng) khi sử dụng tính năng Quét ảnh đề bài.</li>
                  <li>Giáo viên và Quản trị viên chịu trách nhiệm kiểm duyệt các nội dung nhập hàng loạt hoặc bản nháp do AI gợi ý trước khi xuất bản tới học sinh.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">3. Giới hạn sử dụng AI an toàn</h2>
                <p className="text-sm text-slate-700">
                  Mỗi tài khoản học sinh có hạn mức lượt tương tác AI hằng ngày (mặc định 40 lượt/ngày) nhằm bảo vệ sức khỏe thị giác và khuyến khích trẻ cân bằng giữa học trực tuyến và vận động ngoài trời.
                </p>
              </section>
            </>
          )}

          {kind === 'children' && (
            <>
              <header className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <Baby className="w-4 h-4" aria-hidden="true" />
                  <span>Bảo vệ dữ liệu trẻ em theo Điều 20 Nghị định 13/2023/NĐ-CP</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                  Chính sách Bảo vệ Dữ liệu Trẻ em
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Đơn vị chịu trách nhiệm: <strong>[TÊN ĐƠN VỊ]</strong> · Kênh tiếp nhận của phụ huynh: <strong>[EMAIL LIÊN HỆ]</strong>
                </p>
              </header>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">1. Nguyên tắc bất di bất dịch khi xử lý dữ liệu trẻ em</h2>
                <p className="text-sm text-slate-700">
                  Tuân thủ <strong>Điều 20 Nghị định 13/2023/NĐ-CP</strong> của Chính phủ Việt Nam về bảo vệ dữ liệu cá nhân của trẻ em:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1.5 text-slate-700">
                  <li>
                    <strong>Thu thập tối thiểu:</strong> Tài khoản học sinh tiểu học không thu thập email cá nhân, số điện thoại, định vị GPS hay dữ liệu sinh trắc học của trẻ.
                  </li>
                  <li>
                    <strong>Sự đồng ý &amp; liên kết của cha, mẹ hoặc người giám hộ:</strong> Tài khoản học sinh được tạo với trạng thái chờ xác nhận bảo hộ (<code>pending</code>) và cấp mã liên kết riêng (<code>LINK-...</code>) để phụ huynh kiểm tra, liên kết và theo dõi tại Góc Phụ huynh.
                  </li>
                  <li>
                    <strong>Không xếp hạng gây áp lực:</strong> Hệ thống chỉ khen ngợi nỗ lực cá nhân bằng điểm XP và huy hiệu kiên trì, không công khai bảng xếp hạng điểm số giữa các trẻ.
                  </li>
                  <li>
                    <strong>Kiểm duyệt nội dung học liệu:</strong> Mọi bài tập do giáo viên tạo từ AI hoặc nhập từ tệp ngoài đều ở trạng thái Nháp cho đến khi giáo viên/quản trị viên duyệt và xuất bản.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h2 className="font-display text-lg font-extrabold text-slate-900">2. Quyền rút lại đồng ý và yêu cầu xóa dữ liệu của con</h2>
                <p className="text-sm text-slate-700">
                  Cha, mẹ hoặc người giám hộ hợp pháp có quyền yêu cầu xem toàn bộ lịch sử học tập của con, rút lại sự đồng ý xử lý dữ liệu hoặc yêu cầu xóa vĩnh viễn tài khoản của trẻ bất cứ lúc nào qua email <strong>[EMAIL LIÊN HỆ]</strong>. Ngoài ra, hệ thống tự động xóa lịch sử hội thoại quá hạn theo chính sách lưu trữ định kỳ.
                </p>
              </section>
            </>
          )}

          {kind === 'contact' && (
            <>
              <header className="border-b border-slate-100 pb-5">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-sky-700">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>Hỗ trợ Phụ huynh, Giáo viên &amp; Thực hiện quyền dữ liệu</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                  Thông tin Liên hệ
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Quý phụ huynh, thầy cô và nhà trường có thể liên hệ trực tiếp với đội ngũ vận hành SOCRATES KIDS AI.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-sky-800 uppercase tracking-wide">Đơn vị vận hành</div>
                  <div className="font-display text-lg font-extrabold text-slate-900">[TÊN ĐƠN VỊ]</div>
                  <p className="text-sm text-slate-600">
                    Đơn vị phát triển và chịu trách nhiệm bảo vệ dữ liệu người dùng trên nền tảng SOCRATES KIDS AI.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-sky-800 uppercase tracking-wide">Email tiếp nhận hỗ trợ &amp; Dữ liệu cá nhân</div>
                  <div className="font-mono-nums text-base font-extrabold text-slate-900">[EMAIL LIÊN HỆ]</div>
                  <p className="text-sm text-slate-600">
                    Tiếp nhận yêu cầu tra cứu, chỉnh sửa, rút lại đồng ý hoặc xóa dữ liệu trẻ em theo Nghị định 13/2023/NĐ-CP (phản hồi trong vòng 72 giờ làm việc).
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-950 space-y-1.5">
                <div className="font-bold">Hướng dẫn gửi yêu cầu xóa hoặc truy xuất dữ liệu tài khoản học sinh:</div>
                <p>
                  Phụ huynh vui lòng gửi email tới <strong>[EMAIL LIÊN HỆ]</strong> kèm <em>Tên tài khoản của bé</em> và <em>Mã liên kết phụ huynh</em> để chúng tôi xác minh đúng chủ thể bảo hộ trước khi xử lý.
                </p>
              </div>
            </>
          )}
        </article>
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <span>SOCRATES KIDS AI · [TÊN ĐƠN VỊ] · Think. Explore. Learn.</span>
          <div className="flex flex-wrap gap-4 font-semibold">
            <Link to="/chinh-sach-bao-mat" className="hover:text-sky-700">Chính sách bảo mật</Link>
            <Link to="/dieu-khoan-su-dung" className="hover:text-sky-700">Điều khoản sử dụng</Link>
            <Link to="/chinh-sach-du-lieu-tre-em" className="hover:text-sky-700">Chính sách dữ liệu trẻ em</Link>
            <Link to="/lien-he" className="hover:text-sky-700">Liên hệ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
