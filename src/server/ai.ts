import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODEL_NAME = 'gemini-4-hydrogen';

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('GEMINI_API_KEY_MISSING') || msg.includes('400') || msg.includes('403')) {
        throw err;
      }
      if (i < maxRetries) {
        await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export interface ScanProblemResult {
  isReadable: boolean;
  safetyPassed: boolean;
  extractedText: string;
  detectedSubject: string;
  detectedGrade: number;
  topic: string;
  problemType: 'text' | 'formula' | 'table' | 'diagram' | 'mixed';
  readabilityFeedback: string;
}

export async function scanProblemImage(
  base64Data: string,
  mimeType: string,
  gradeHint?: number,
  subjectHint?: string
): Promise<ScanProblemResult> {
  const ai = getAiClient();

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const prompt = `Bạn là hệ thống OCR & phân tích đề bài tiểu học Việt Nam (Lớp 1–5) của SOCRATES KIDS AI.
Hãy kiểm tra bức ảnh được gửi lên:
1. Kiểm tra an toàn trẻ em (safetyPassed): false nếu ảnh chứa nội dung bạo lực, nhạy cảm, không phù hợp với học sinh tiểu học.
2. Kiểm tra độ rõ và tính đầy đủ (isReadable): Nếu ảnh quá mờ, bị cắt mất đề bài, không thấy chữ/số hoặc không phải bài học, đặt isReadable = false và KHÔNG tự suy đoán đề bài. Ghi rõ lý do và hướng dẫn bé chụp lại vào readabilityFeedback.
3. Nếu ảnh đọc được: Trích xuất chính xác toàn bộ nội dung đề bài (bao gồm văn bản tiếng Việt có dấu, phép tính, phân số, số liệu trong bảng hoặc mô tả ngắn sơ đồ) vào extractedText.
4. Phân loại môn học (detectedSubject) thuộc chương trình tiểu học Việt Nam (Toán học, Tiếng Việt, Tự nhiên & Khoa học, Tiếng Anh, Đạo đức & Kỹ năng, Lịch sử & Địa lí, Tin học & Công nghệ), lớp dự kiến (detectedGrade từ 1 đến 5, tham khảo gợi ý lớp ${gradeHint || 4}), chủ đề (topic), và loại nội dung (problemType).
${subjectHint ? `Gợi ý môn từ học sinh: ${subjectHint}.` : ''}`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isReadable: { type: Type.BOOLEAN },
            safetyPassed: { type: Type.BOOLEAN },
            extractedText: { type: Type.STRING },
            detectedSubject: { type: Type.STRING },
            detectedGrade: { type: Type.INTEGER },
            topic: { type: Type.STRING },
            problemType: { type: Type.STRING },
            readabilityFeedback: { type: Type.STRING },
          },
          required: [
            'isReadable',
            'safetyPassed',
            'extractedText',
            'detectedSubject',
            'detectedGrade',
            'topic',
            'problemType',
            'readabilityFeedback',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as ScanProblemResult;
    return {
      isReadable: Boolean(parsed.isReadable),
      safetyPassed: parsed.safetyPassed !== false,
      extractedText: parsed.extractedText || '',
      detectedSubject: parsed.detectedSubject || subjectHint || 'Toán học',
      detectedGrade: Math.min(5, Math.max(1, Number(parsed.detectedGrade) || gradeHint || 4)),
      topic: parsed.topic || 'Bài tập từ ảnh chụp',
      problemType: (['text', 'formula', 'table', 'diagram', 'mixed'].includes(parsed.problemType)
        ? parsed.problemType
        : 'text') as ScanProblemResult['problemType'],
      readabilityFeedback: parsed.readabilityFeedback || '',
    };
  });
}

export interface SocraticTurnInput {
  studentName: string;
  gradeLevel: number;
  subjectName: string;
  mode: 'socratic' | 'hint' | 'concept' | 'challenge';
  hintLevel: number;
  revealSolutionRequested?: boolean;
  topic: string;
  problemText: string;
  history: Array<{ sender: 'student' | 'soco'; content: string }>;
  studentMessage: string;
  socraticStrictness?: string;
}

export interface SocraticTurnOutput {
  reply: string;
  socoEmotion: 'happy' | 'thinking' | 'cheering' | 'explaining';
  pedagogicalAnalysis: {
    questionGoal: string;
    testedSkill: string;
    understandingLevel: number;
    detectedMistake: string;
    mistakeCategory: string;
    nextStepHint: string;
  };
  detectedSubject: string;
  topic: string;
  learningObjective: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prerequisites: string[];
  isSolvedByStudent: boolean;
  similarChallengeProblem: string;
  safetyFlagged: boolean;
}

function getGradeDifferentiationGuide(gradeLevel: number): string {
  if (gradeLevel <= 2) {
    return `PHÂN HÓA LỚP ${gradeLevel} (Khối 1–2):
- Dùng câu rất ngắn, từ ngữ cực kỳ đơn giản, gần gũi với trẻ 6–8 tuổi.
- Mỗi lượt chỉ đặt ĐÚNG 1 câu hỏi nhỏ, dễ hiểu.
- Luôn dùng ví dụ bằng đồ vật quen thuộc (viên bi, quả táo, bút chì, cái kẹo, ngón tay) hoặc hình ảnh trực quan.`;
  }
  if (gradeLevel === 3) {
    return `PHÂN HÓA LỚP 3:
- Hướng dẫn thực hành từng bước rõ ràng.
- Tăng câu hỏi "Vì sao em nghĩ vậy?" hoặc "Em làm thế nào để ra bước này?".
- Sử dụng ví dụ đời sống gần gũi (sân trường, chia bánh, đọc đồng hồ, đi chợ cùng mẹ).`;
  }
  return `PHÂN HÓA LỚP ${gradeLevel} (Khối 4–5):
- Tăng câu hỏi phân tích, so sánh và khái quát hóa.
- Khuyến khích học sinh trình bày phương pháp giải của mình trước khi tính toán.
- Hỗ trợ tư duy các bài toán/tình huống nhiều bước một cách mạch lạc.`;
}

function getModeInstructions(mode: string, hintLevel: number, revealSolutionRequested?: boolean): string {
  if (mode === 'socratic') {
    return `CHẾ ĐỘ SOCRATIC (NGHIÊM NGẶT):
- TUYỆT ĐỐI KHÔNG đưa đáp án cuối cùng hay làm hộ bài toán trong chế độ này.
- Thực hiện quy trình: Hiểu đề -> Xác định điều em đã biết -> Chỉ ra nhẹ nhàng nếu có nhầm lẫn -> Đặt DUY NHẤT 1 câu hỏi dẫn dắt bước tiếp theo.
- Nếu học sinh đã tự tìm ra đáp án đúng, hãy khen ngợi cụ thể quá trình tư duy, tổng kết ngắn gọn kiến thức trọng tâm, đặt isSolvedByStudent = true và tặng 1 bài tập tương tự ở similarChallengeProblem.`;
  }
  if (mode === 'hint') {
    if (revealSolutionRequested && hintLevel >= 3) {
      return `CHẾ ĐỘ GỢI Ý (HỌC SINH CHỦ ĐỘNG XIN XEM CÁCH GIẢI SAU KHI ĐÃ THỬ 3 CẤP GỢI Ý):
- Trình bày lời giải mẫu từng bước thật dễ hiểu để em tự đối chiếu, sau đó hỏi 1 câu kiểm tra xem em đã hiểu bước nào nhất và tạo 1 bài tương tự trong similarChallengeProblem.`;
    }
    return `CHẾ ĐỘ GỢI Ý CẤP ĐỘ ${hintLevel}/3:
- Cấp 1: Chỉ nhắc lại kiến thức/quy tắc nền tảng liên quan, không giải.
- Cấp 2: Hướng dẫn phương pháp chia nhỏ bài toán thành các bước.
- Cấp 3: Minh họa một ví dụ tương tự khác số/ngữ cảnh để em tự áp dụng vào bài của mình (vẫn chưa đưa đáp số bài gốc).`;
  }
  if (mode === 'concept') {
    return `CHẾ ĐỘ GIẢI THÍCH KHÁI NIỆM (CONCEPT MODE):
- Giải thích bản chất kiến thức ngắn gọn, trong sáng, không dùng thuật ngữ khó khi chưa giải thích.
- Dùng ít nhất 1 ví dụ đời sống dễ hình dung hoặc mô tả sơ đồ tư duy bằng chữ trực quan.
- Kết thúc bằng 1 câu hỏi nhẹ kiểm tra mức độ hiểu của học sinh.`;
  }
  return `CHẾ ĐỘ THỬ THÁCH (CHALLENGE MODE):
- Đánh giá câu trả lời của học sinh nếu có, sau đó đưa ra hoặc điều chỉnh độ khó của bài tập tương tự giúp học sinh tự vận dụng kiến thức vừa học.`;
}

export async function generateSocraticTurn(input: SocraticTurnInput): Promise<SocraticTurnOutput> {
  const ai = getAiClient();

  const systemInstruction = `Bạn là SOCO, người bạn đồng hành học tập thông minh của học sinh tiểu học Việt Nam từ lớp 1 đến lớp 5 thuộc nền tảng SOCRATES KIDS AI.
Bạn KHÔNG phải là công cụ giải bài tập tự động. Sứ mệnh của bạn là giúp học sinh TỰ KHÁM PHÁ KIẾN THỨC.

15 NGUYÊN TẮC CỐT LÕI:
1. Luôn giao tiếp thân thiện, tích cực, kiên nhẫn, xưng "SOCO" và gọi học sinh là "${input.studentName}" hoặc "em".
2. Ngôn ngữ phù hợp độ tuổi lớp ${input.gradeLevel}.
3. Không dùng thuật ngữ khó khi chưa giải thích.
4. KHÔNG đưa đáp án ngay trong Socratic Mode.
5. Mỗi lượt chỉ đặt MỘT câu hỏi chính (trừ phần bài tập tương tự tách riêng ở trường similarChallengeProblem).
6. Khen ngợi cụ thể khi học sinh có tiến bộ hoặc dám thử suy nghĩ.
7. Không chê bai, gây áp lực hoặc khiến trẻ xấu hổ.
8. Không lặp lại câu hỏi máy móc; nếu học sinh chưa hiểu, hãy đơn giản hóa câu hỏi.
9. Phân tích câu trả lời dựa trên kiến thức thực tế, tìm nguyên nhân sai trước khi gợi ý.
10. Không bịa kiến thức.
11. Không tự nhận mình là giáo viên hay con người thật (luôn là bạn đồng hành AI SOCO).
12. Không yêu cầu học sinh tiết lộ thông tin cá nhân (địa chỉ, số điện thoại, mật khẩu...).
13. AN TOÀN TRẺ EM: Nếu học sinh hỏi nội dung bạo lực, nhạy cảm, tự làm hại hoặc vượt ngoài mục đích giáo dục tiểu học phù hợp, đặt safetyFlagged = true và nhẹ nhàng hướng em trao đổi với bố mẹ hoặc thầy cô đáng tin cậy.
14. Không để lộ suy luận nội bộ; chỉ xuất kết quả JSON đúng schema.

${getGradeDifferentiationGuide(input.gradeLevel)}

${getModeInstructions(input.mode, input.hintLevel, input.revealSolutionRequested)}`;

  const historyText = input.history
    .slice(-10)
    .map((m) => `${m.sender === 'student' ? 'Học sinh' : 'SOCO'}: ${m.content}`)
    .join('\n');

  const prompt = `Ngữ cảnh phiên học:
- Môn học: ${input.subjectName}
- Lớp: Lớp ${input.gradeLevel}
- Chủ đề: ${input.topic}
- Đề bài / Nội dung ban đầu: ${input.problemText || '(Chưa có đề cụ thể, học sinh đang đặt câu hỏi)'}

Lịch sử hội thoại gần nhất:
${historyText || '(Bắt đầu cuộc trò chuyện mới)'}

Tin nhắn mới của học sinh:
"${input.studentMessage}"

Hãy phản hồi sư phạm chuẩn mực và trả về JSON đầy đủ các trường theo schema.`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            socoEmotion: { type: Type.STRING },
            pedagogicalAnalysis: {
              type: Type.OBJECT,
              properties: {
                questionGoal: { type: Type.STRING },
                testedSkill: { type: Type.STRING },
                understandingLevel: { type: Type.INTEGER },
                detectedMistake: { type: Type.STRING },
                mistakeCategory: { type: Type.STRING },
                nextStepHint: { type: Type.STRING },
              },
              required: ['questionGoal', 'testedSkill', 'understandingLevel', 'detectedMistake', 'mistakeCategory', 'nextStepHint'],
            },
            detectedSubject: { type: Type.STRING },
            topic: { type: Type.STRING },
            learningObjective: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
            isSolvedByStudent: { type: Type.BOOLEAN },
            similarChallengeProblem: { type: Type.STRING },
            safetyFlagged: { type: Type.BOOLEAN },
          },
          required: [
            'reply',
            'socoEmotion',
            'pedagogicalAnalysis',
            'detectedSubject',
            'topic',
            'learningObjective',
            'difficulty',
            'prerequisites',
            'isSolvedByStudent',
            'similarChallengeProblem',
            'safetyFlagged',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as SocraticTurnOutput;
    const validEmotions = ['happy', 'thinking', 'cheering', 'explaining'];
    const validDiff = ['easy', 'medium', 'hard'];
    return {
      reply: parsed.reply || 'SOCO đang lắng nghe em đây! Em có thể nói thêm một chút về điều em đang nghĩ không?',
      socoEmotion: (validEmotions.includes(parsed.socoEmotion) ? parsed.socoEmotion : 'explaining') as SocraticTurnOutput['socoEmotion'],
      pedagogicalAnalysis: {
        questionGoal: parsed.pedagogicalAnalysis?.questionGoal || 'Gợi mở tư duy từng bước',
        testedSkill: parsed.pedagogicalAnalysis?.testedSkill || input.topic,
        understandingLevel: Math.min(5, Math.max(1, Number(parsed.pedagogicalAnalysis?.understandingLevel) || 3)),
        detectedMistake: parsed.pedagogicalAnalysis?.detectedMistake || '',
        mistakeCategory: parsed.pedagogicalAnalysis?.mistakeCategory || '',
        nextStepHint: parsed.pedagogicalAnalysis?.nextStepHint || '',
      },
      detectedSubject: parsed.detectedSubject || input.subjectName,
      topic: parsed.topic || input.topic,
      learningObjective: parsed.learningObjective || 'Hiểu bản chất kiến thức và tự tìm lời giải',
      difficulty: (validDiff.includes(parsed.difficulty) ? parsed.difficulty : 'medium') as SocraticTurnOutput['difficulty'],
      prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites.slice(0, 4) : [],
      isSolvedByStudent: Boolean(parsed.isSolvedByStudent),
      similarChallengeProblem: parsed.similarChallengeProblem || '',
      safetyFlagged: Boolean(parsed.safetyFlagged),
    };
  });
}

export async function generateParentCompanionAdvice(params: {
  studentName: string;
  gradeLevel: number;
  masterySummary: string;
  mistakesSummary: string;
  studyMinutes: number;
}): Promise<{ summary: string; homeActivities: Array<{ title: string; duration: string; howTo: string }> }> {
  const ai = getAiClient();
  const prompt = `Bạn là chuyên gia giáo dục tiểu học Việt Nam tư vấn cho phụ huynh.
Học sinh: ${params.studentName}, Lớp ${params.gradeLevel}.
Thời gian học đã ghi nhận: ${params.studyMinutes} phút.
Mức độ nắm vững kiến thức: ${params.masterySummary}
Lỗi thường gặp: ${params.mistakesSummary || 'Chưa ghi nhận lỗi lặp lại đáng kể.'}

Hãy viết bằng Tiếng Việt ấm áp, không gây áp lực điểm số:
1. summary: Nhận xét ngắn gọn, khích lệ về tiến bộ và điểm cần đồng hành nhẹ nhàng.
2. homeActivities: 3 hoạt động đồng hành tại nhà 10–15 phút gắn với sinh hoạt gia đình.`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            homeActivities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  howTo: { type: Type.STRING },
                },
                required: ['title', 'duration', 'howTo'],
              },
            },
          },
          required: ['summary', 'homeActivities'],
        },
      },
    });
    return JSON.parse((response.text ?? '{}').trim());
  });
}

export async function generateTeacherClassInsights(params: {
  className: string;
  gradeLevel: number;
  studentCount: number;
  commonMistakes: string;
  avgScore: number;
}): Promise<{ overview: string; actionPlan: string[] }> {
  const ai = getAiClient();
  const prompt = `Bạn là cố vấn sư phạm tiểu học hỗ trợ giáo viên phân tích dữ liệu lớp học.
Lớp: ${params.className} (Lớp ${params.gradeLevel}), Sĩ số: ${params.studentCount} học sinh.
Điểm trung bình bài tập: ${params.avgScore}%.
Các lỗi sai phổ biến của lớp: ${params.commonMistakes || 'Chưa có nhiều lỗi sai nổi bật.'}

Hãy đề xuất ngắn gọn bằng Tiếng Việt:
1. overview: Nhận định tổng quan năng lực lớp.
2. actionPlan: 3 biện pháp sư phạm Socratic trên lớp để giúp học sinh khắc phục lỗi sai.`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['overview', 'actionPlan'],
        },
      },
    });
    return JSON.parse((response.text ?? '{}').trim());
  });
}
