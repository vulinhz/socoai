import heroLearningWorldImg from '../assets/images/hero_learning_world.webp';
import socoMascotImg from '../assets/images/soco_mascot.webp';
import lessonMathImg from '../assets/images/lesson_math_fractions.webp';
import lessonVietnameseImg from '../assets/images/lesson_vietnamese_story.webp';
import lessonScienceImg from '../assets/images/lesson_science_nature.webp';

export {
  heroLearningWorldImg,
  socoMascotImg,
  lessonMathImg,
  lessonVietnameseImg,
  lessonScienceImg,
};

export function resolveAssetUrl(rawUrl?: string | null): string {
  if (!rawUrl) return heroLearningWorldImg;
  const val = rawUrl.trim();
  if (!val) return heroLearningWorldImg;

  if (val.includes('soco_mascot')) return socoMascotImg;
  if (val.includes('lesson_math_fractions')) return lessonMathImg;
  if (val.includes('lesson_vietnamese_story')) return lessonVietnameseImg;
  if (val.includes('lesson_science_nature')) return lessonScienceImg;
  if (val.includes('hero_learning_world')) return heroLearningWorldImg;

  if (/^(https?:\/\/|data:|blob:)/i.test(val) || val.startsWith('/')) {
    return val;
  }
  return heroLearningWorldImg;
}
