import React from 'react';
import { Link } from 'react-router';
import { Home } from 'lucide-react';
import { usePageSeo } from '../lib/seo';
import { SocoMascot } from './SocoMascot';

export function NotFoundPage({ homePath = '/' }: { homePath?: string }) {
  usePageSeo({
    title: 'Không tìm thấy trang (404) · SOCRATES KIDS AI',
    description: 'Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.',
  });

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center space-y-5">
        <div className="text-sm font-extrabold text-sky-700 uppercase tracking-wider">Lỗi 404</div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
          Ôi! Trang này chưa có trên bản đồ tri thức
        </h1>
        <div className="flex justify-center text-left">
          <SocoMascot
            emotion="thinking"
            size="md"
            speech="Có vẻ em vừa đi nhầm đường dẫn rồi. Hãy nhấn nút bên dưới để quay lại Thế giới Học tập nhé!"
          />
        </div>
        <div className="pt-2">
          <Link
            to={homePath}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Quay lại trang chính</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
