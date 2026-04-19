/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  RefreshCcw, 
  Info, 
  Zap, 
  AlertTriangle, 
  ChevronRight, 
  Sparkles,
  LayoutGrid,
  BarChart3,
  Share2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { QRCodeSVG } from 'qrcode.react';

// --- Types & Constants ---

type MBTIType = 
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

type RankType = '그룹장' | '담당' | '팀장' | '책임' | '선임' | '사원';

interface TeamMember {
  id: string;
  name: string;
  mbti: MBTIType;
  rank: RankType;
  birthDate?: string; // YYYY-MM-DD
  birthTime?: string; // HH:mm
  role?: string;
}

const HEAVENLY_STEMS_KOR = ['갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수'];
const ELEMENTS_KOR: Record<string, string> = {
  '갑목': '나무(木)', '을목': '나무(木)', 
  '병화': '불(火)', '정화': '불(火)',
  '무토': '흙(土)', '기토': '흙(土)',
  '경금': '쇠(金)', '신금': '쇠(金)',
  '임수': '물(水)', '계수': '물(水)'
};

const getIlgan = (dateStr?: string): { stem: string; element: string } | null => {
  if (!dateStr) return null;
  const birth = new Date(dateStr);
  if (isNaN(birth.getTime())) return null;
  
  // Reference: 2000-01-01 was 'Mu'(戊) day (index 4 in 10-cycle) -> Mu-to(무토) is 4th in our list
  const ref = new Date('2000-01-01');
  const diffTime = birth.getTime() - ref.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let index = (4 + diffDays) % 10;
  if (index < 0) index += 10;
  
  const stem = HEAVENLY_STEMS_KOR[index];
  return { stem, element: ELEMENTS_KOR[stem] };
};

const RANKS: RankType[] = ['그룹장', '담당', '팀장', '책임', '선임', '사원'];
const RANK_ORDER: Record<RankType, number> = {
  '그룹장': 5,
  '담당': 4,
  '팀장': 3,
  '책임': 2,
  '선임': 1,
  '사원': 0
};

interface CompatibilityResult {
  score: number;
  level: 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Challenging';
  synergy: string[];
  caution: string[];
  rankInsight?: string;
  sajuInsight?: string;
}

const MBTI_TYPES: MBTIType[] = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP'
];

// Simplified cognitive function mapping for logic
const COGNITIVE_FUNCTIONS: Record<MBTIType, string[]> = {
  INTJ: ['Ni', 'Te', 'Fi', 'Se'],
  INTP: ['Ti', 'Ne', 'Si', 'Fe'],
  ENTJ: ['Te', 'Ni', 'Se', 'Fi'],
  ENTP: ['Ne', 'Ti', 'Fe', 'Si'],
  INFJ: ['Ni', 'Fe', 'Ti', 'Se'],
  INFP: ['Fi', 'Ne', 'Si', 'Te'],
  ENFJ: ['Fe', 'Ni', 'Se', 'Ti'],
  ENFP: ['Ne', 'Fi', 'Te', 'Si'],
  ISTJ: ['Si', 'Te', 'Fi', 'Ne'],
  ISFJ: ['Si', 'Fe', 'Ti', 'Ne'],
  ESTJ: ['Te', 'Si', 'Ne', 'Fi'],
  ESFJ: ['Fe', 'Si', 'Ne', 'Ti'],
  ISTP: ['Ti', 'Se', 'Ni', 'Fe'],
  ISFP: ['Fi', 'Se', 'Ni', 'Te'],
  ESTP: ['Se', 'Ti', 'Fe', 'Ni'],
  ESFP: ['Se', 'Fi', 'Te', 'Ni']
};

// --- Logic Helpers ---

const calculateCompatibility = (m1: TeamMember, m2: TeamMember): CompatibilityResult => {
  const mbti1 = m1.mbti;
  const mbti2 = m2.mbti;

  if (mbti1 === mbti2) {
    return {
      score: 85,
      level: 'Excellent',
      synergy: ['사고방식과 가치관이 매우 유사함', '별도 설명 없이도 서로의 의도를 잘 파악함'],
      caution: ['서로의 단점까지 닮아있어 객관성 상실 가능성', '팀 내 다양성 부족 우려']
    };
  }

  const axes1 = mbti1.split('');
  const axes2 = mbti2.split('');

  let score = 50;
  const synergy: string[] = [];
  const caution: string[] = [];
  let rankInsight = '';

  // 1. Rank-based Dynamic Logic (Hierarchy Awareness)
  const order1 = RANK_ORDER[m1.rank];
  const order2 = RANK_ORDER[m2.rank];
  
  if (order1 !== order2) {
    const superior = order1 > order2 ? m1 : m2;
    const subordinate = order1 > order2 ? m2 : m1;
    const sAxes = superior.mbti.split('');
    const bAxes = subordinate.mbti.split('');

    // Case: Superior is F, Subordinate is T
    if (sAxes[2] === 'F' && bAxes[2] === 'T') {
      score -= 10;
      rankInsight = `리더(${superior.name})의 감성적 접근을 실무자(${subordinate.name})가 비효율적으로 느낄 수 있으며, 리더가 팀원의 논리 공세를 방어하거나 컨트롤하는 데 심리적 부담을 느낄 수 있습니다.`;
      caution.push('상급자가 하급자의 직설적 비판에 위축될 가능성');
    }
    // Case: Superior is P, Subordinate is J
    else if (sAxes[3] === 'P' && bAxes[3] === 'J') {
      score -= 5;
      rankInsight = `리더(${superior.name})의 유연하고 즉흥적인 지시가 체계적인 가이드라인을 원하는 하급자(${subordinate.name})에게 혼란을 줄 수 있어 관리 권위가 약해질 우려가 있습니다.`;
      caution.push('상급자의 불명확한 마감 설정으로 인한 하급자의 불만 발생 가능');
    }
    // Case: Superior is T, Subordinate is F
    else if (sAxes[2] === 'T' && bAxes[2] === 'F') {
      score += 5;
      rankInsight = `리더(${superior.name})의 명확한 논리가 안정감을 주지만, 하급자(${subordinate.name})는 정서적 지지 결여로 인해 리더를 '차갑다'고 느끼며 거리감을 둘 수 있습니다.`;
    }
  }

  // 2. Original MBTI logic
  // Perception Axis (S/N)
  if (axes1[1] === axes2[1]) {
    score += 15;
    synergy.push(axes1[1] === 'N' ? '추상적 아이디어와 비전 공유 능력이 탁월함' : '구체적인 데이터와 사실 기반의 업무 수행이 원활함');
  } else {
    score -= 5;
    caution.push('데이터 처리 방식의 차이로 인한 의사소통 비효율 발생 가능');
  }

  // Judgment Axis (T/F)
  if (axes1[2] === axes2[2]) {
    score += 15;
    synergy.push(axes1[2] === 'T' ? '논리적이고 객관적인 평가 기준을 공유함' : '팀의 화합과 인간적인 가치를 우선순위에 둠');
  } 

  // Work Pattern (J/P)
  if (axes1[3] === axes2[3]) {
    score += 10;
    synergy.push(axes1[3] === 'J' ? '체계적인 계획과 마감 기한 준수가 확실함' : '상황에 따른 유연한 대처와 창의적 접근에 능함');
  } else {
    score += 5; 
    synergy.push('계획성과 유연함의 조화로 상호 보완적인 팀워크 가능');
  }

  // Energy Direction (E/I)
  if (axes1[0] !== axes2[0]) {
    score += 5;
    synergy.push('외향성과 내향성의 균형으로 팀의 에너지 레벨 최적화');
  }

    // 3. Saju Basic Logic (Ilgan Sangsaeng/Sanggeuk)
    const ilgan1 = getIlgan(m1.birthDate);
    const ilgan2 = getIlgan(m2.birthDate);
    let sajuInsight = '';

    if (ilgan1 && ilgan2) {
      const e1 = ilgan1.element.split('(')[0];
      const e2 = ilgan2.element.split('(')[0];
      const s1 = ilgan1.stem;
      const s2 = ilgan2.stem;
      
      const generation: Record<string, string> = { '나무': '불', '불': '흙', '흙': '쇠', '쇠': '물', '물': '나무' };
      const control: Record<string, string> = { '나무': '흙', '흙': '물', '물': '불', '불': '쇠', '쇠': '나무' };

      // Detailed Ilgan Pairings
      const detailedPairings: Record<string, string> = {
        '갑목-무토': '거대한 나무가 넓은 땅에 뿌리를 내리는 형상입니다. 서로의 영역을 존중하며 큰 성과를 낼 수 있는 비즈니스 파트너입니다.',
        '무토-갑목': '거대한 나무가 넓은 땅에 뿌리를 내리는 형상입니다. 서로의 영역을 존중하며 큰 성과를 낼 수 있는 비즈니스 파트너입니다.',
        '병화-신금': '강렬한 태양이 보석을 빛내주는 형상입니다. 서로의 가치를 극대화하는 관계이나 지나친 간섭은 피해야 합니다.',
        '신금-병화': '강렬한 태양이 보석을 빛내주는 형상입니다. 서로의 가치를 극대화하는 관계이나 지나친 간섭은 피해야 합니다.',
        '정화-임수': '작은 등불이 큰 강물에 비치는 형상입니다. 정서적 유대감이 깊고 조화로운 협업이 가능한 관계입니다.',
        '임수-정화': '작은 등불이 큰 강물에 비치는 형상입니다. 정서적 유대감이 깊고 조화로운 협업이 가능한 관계입니다.',
        '을목-경금': '부드러운 화초가 단단한 바위를 휘감는 형상입니다. 유연함과 강직함이 만나 균형 잡힌 팀워크를 보여줍니다.',
        '경금-을목': '부드러운 화초가 단단한 바위를 휘감는 형상입니다. 유연함과 강직함이 만나 균형 잡힌 팀워크를 보여줍니다.'
      };

      const pairKey = `${s1}-${s2}`;
      if (detailedPairings[pairKey]) {
        score += 8;
        sajuInsight = `[궁합: ${s1} & ${s2}] ${detailedPairings[pairKey]}`;
      } else if (generation[e1] === e2 || generation[e2] === e1) {
        score += 5;
        sajuInsight = `${s1}와 ${s2}는 서로 상생(相生)하는 관계로, 한 쪽의 기운이 다른 쪽을 북돋아주는 긍정적인 파트너십입니다.`;
      } else if (control[e1] === e2 || control[e2] === e1) {
        score -= 5;
        sajuInsight = `${s1}와 ${s2}는 서로 상극(相剋)인 면이 있습니다. 생각이 충돌할 때 감정적으로 대응하기보다 규정된 절차에 따르는 것이 좋습니다.`;
      } else {
        sajuInsight = `${s1}와 ${s2}는 기운이 중첩되거나 무난하게 융합됩니다. 서로의 역전된 스타일을 존중하면 최상의 효율이 납니다.`;
      }
    }

    // Final score capping
    score = Math.min(Math.max(score, 30), 98);

    let level: CompatibilityResult['level'] = 'Good';
    if (score >= 90) level = 'Excellent';
    else if (score >= 75) level = 'Great';
    else if (score >= 60) level = 'Good';
    else if (score >= 45) level = 'Fair';
    else level = 'Challenging';

    return { score, level, synergy, caution, rankInsight, sajuInsight };
};

// --- Main Components ---

const DEFAULT_MEMBERS: TeamMember[] = [
  { id: '1', name: '김민준', mbti: 'ENTJ', rank: '팀장', role: '리더', birthDate: '1990-05-15', birthTime: '10:30' },
  { id: '2', name: '이서연', mbti: 'INFP', rank: '선임', role: '디자이너', birthDate: '1995-11-22', birthTime: '14:00' },
  { id: '3', name: '박지훈', mbti: 'ISTJ', rank: '책임', role: '개발자', birthDate: '1988-02-03', birthTime: '08:15' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'management'>('analysis');
  const [showMobileModal, setShowMobileModal] = useState(false);
  
  // Persistence logic
  const [members, setMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('team_fit_members');
      return saved ? JSON.parse(saved) : DEFAULT_MEMBERS;
    } catch {
      return DEFAULT_MEMBERS;
    }
  });

  useEffect(() => {
    localStorage.setItem('team_fit_members', JSON.stringify(members));
  }, [members]);

  const [newName, setNewName] = useState('');
  const [newMbti, setNewMbti] = useState<MBTIType>('INTJ');
  const [newRank, setNewRank] = useState<RankType>('사원');
  const [newRole, setNewRole] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newBirthTime, setNewBirthTime] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TeamMember | null>(null);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);
  const [pairTab, setPairTab] = useState<'summary' | 'mbti' | 'saju'>('summary');
  const [reportTab, setReportTab] = useState<'summary' | 'mbti' | 'saju'>('summary');

  const [selectedInAnalysis, setSelectedInAnalysis] = useState<Set<string>>(new Set());

  // Initialize selected members when members change
  useEffect(() => {
    if (members.length > 0 && selectedInAnalysis.size === 0) {
      setSelectedInAnalysis(new Set(members.map(m => m.id)));
    }
  }, [members.length]);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedInAnalysis);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedInAnalysis(newSelection);
    setAiInsight(null);
  };

  const analyzedMembers = useMemo(() => {
    return members.filter(m => selectedInAnalysis.has(m.id));
  }, [members, selectedInAnalysis]);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newMember: TeamMember = {
      id: newId,
      name: newName,
      mbti: newMbti,
      rank: newRank,
      birthDate: newBirthDate || undefined,
      birthTime: newBirthTime || undefined,
      role: newRole || undefined,
    };
    setMembers([...members, newMember]);
    setSelectedInAnalysis(prev => new Set(prev).add(newId));
    setNewName('');
    setNewRole('');
    setNewBirthDate('');
    setNewBirthTime('');
    setAiInsight(null);
  };

  const removeMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
    setSelectedInAnalysis(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setAiInsight(null);
  };

  const startEditing = (member: TeamMember) => {
    setEditingId(member.id);
    setEditForm({ ...member });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editForm) return;
    setMembers(members.map(m => m.id === editForm.id ? editForm : m));
    setEditingId(null);
    setEditForm(null);
    setAiInsight(null);
  };

  const generateAIInsight = async () => {
    if (analyzedMembers.length < 2) return;
    setIsAiLoading(true);
    setAiInsight(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const teamDescription = analyzedMembers.map(m => {
        const ilgan = getIlgan(m.birthDate);
        return `${m.name}(MBTI: ${m.mbti}, 직급: ${m.rank}, 역할: ${m.role || '팀원'}, 사주 일간: ${ilgan ? ilgan.stem : '미입력'}, 생년월일시: ${m.birthDate || '미입력'} ${m.birthTime || ''})`;
      }).join('\n');
      
      const promptText = `당신은 MBTI와 동양 사주명리학(사주) 기반 조직 심리학 전문가입니다. 
      다음 팀원 구성을 분석하여 "요약", "MBTI 관점", "사주 관점"의 3가지 영역에서 정밀 리포트를 제공해주세요.
      답변은 반드시 [요약], [MBTI 분석], [사주 분석]이라는 명확한 태그로 구분하여 작성하십시오.
      
      선택된 분석 대상:
      ${teamDescription}
      
      분석 시 고려사항:
      1. [요약]: 팀의 전체적인 조화와 성과 창출 가능성 요약 (직급 체계 상하관계 포함)
      2. [MBTI 분석]: MBTI 유형별 특성과 인지 기능에 따른 업무 시너지 및 갈등 해소 방안
      3. [사주 분석]: 각 팀원의 일간(Day Stem)과 오행(Five Elements)의 상생상극을 분석하여 기운의 흐름과 보완점 제시
      
      직급 체계: 그룹장 > 담당 > 팀장 > 책임 > 선임 > 사원
      답변은 친절하고 전문적인 말투로, 한국어로 작성해주세요. 마크다운 형식을 사용하세요.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptText,
      });
      
      const output = response.text;
      
      setAiInsight(output || "분석 결과를 생성할 수 없습니다.");
    } catch (error: any) {
      console.error("AI Insight error:", error);
      let errorMsg = "AI 분석 중 오류가 발생했습니다. 나중에 다시 시도해주세요.";
      if (error?.message?.includes('API key')) {
        errorMsg = "API 키 설정에 문제가 있습니다. 관리자에게 문의하세요.";
      }
      setAiInsight(errorMsg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const matrix = useMemo(() => {
    return analyzedMembers.map(m1 => 
      analyzedMembers.map(m2 => calculateCompatibility(m1, m2))
    );
  }, [analyzedMembers]);

  const getScoreClass = (score: number) => {
    if (score >= 80) return 'bg-[#D1FAE5] text-[#065F46]';
    if (score >= 60) return 'bg-[#FEF3C7] text-[#92400E]';
    return 'bg-[#FEE2E2] text-[#991B1B]';
  };

  const avgScore = useMemo(() => {
    if (analyzedMembers.length < 2) return 0;
    let total = 0;
    let count = 0;
    for (let i = 0; i < analyzedMembers.length; i++) {
      for (let j = i + 1; j < analyzedMembers.length; j++) {
        total += calculateCompatibility(analyzedMembers[i], analyzedMembers[j]).score;
        count++;
      }
    }
    return Math.round(total / count);
  }, [analyzedMembers]);

  const glueMember = useMemo(() => {
    if (analyzedMembers.length < 1) return null;
    if (analyzedMembers.length === 1) return analyzedMembers[0];
    
    let bestMember = analyzedMembers[0];
    let highestAvg = -1;

    for (let i = 0; i < analyzedMembers.length; i++) {
      let sum = 0;
      for (let j = 0; j < analyzedMembers.length; j++) {
        if (i === j) continue;
        sum += calculateCompatibility(analyzedMembers[i], analyzedMembers[j]).score;
      }
      const avg = sum / (analyzedMembers.length - 1);
      if (avg > highestAvg) {
        highestAvg = avg;
        bestMember = analyzedMembers[i];
      }
    }
    return bestMember;
  }, [analyzedMembers]);

  return (
    <div className="flex flex-col h-screen bg-slate-bg text-slate-text font-sans selection:bg-brand-blue/10">
      {/* --- Mobile Bottom Navigation --- */}
      <footer className="md:hidden h-16 shrink-0 bg-white border-t border-slate-border flex items-center justify-around px-6 z-30 fixed bottom-0 left-0 right-0">
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'analysis' ? 'text-brand-blue' : 'text-slate-muted hover:text-slate-text'}`}
        >
          <BarChart3 size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Analysis</span>
        </button>
        <button 
          onClick={() => setActiveTab('management')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'management' ? 'text-brand-blue' : 'text-slate-muted hover:text-slate-text'}`}
        >
          <Users size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Management</span>
        </button>
      </footer>

      {/* --- Desktop Header --- */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-border flex items-center justify-between px-6 z-20 sticky top-0 md:static">
        <div className="flex items-center gap-2">
          <div className="text-xl font-extrabold tracking-tighter text-brand-blue">TeamFit.</div>
          <span className="hidden sm:inline-block px-1.5 py-0.5 bg-brand-blue/10 text-brand-blue text-[10px] font-black rounded uppercase">Mobile</span>
        </div>
        <nav className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`text-sm h-16 flex items-center transition-all ${activeTab === 'analysis' ? 'font-semibold text-brand-blue border-b-2 border-brand-blue' : 'font-medium text-slate-muted hover:text-slate-text'}`}
            >
              Analysis
            </button>
            <button 
              onClick={() => setActiveTab('management')}
              className={`text-sm h-16 flex items-center transition-all ${activeTab === 'management' ? 'font-semibold text-brand-blue border-b-2 border-brand-blue' : 'font-medium text-slate-muted hover:text-slate-text'}`}
            >
              Management
            </button>
          </div>
          <button 
            onClick={() => setShowMobileModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-brand-blue text-white text-xs font-bold rounded-full hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Share2 size={14} /> <span className="hidden xs:inline">Install App</span>
          </button>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden pb-16 md:pb-0">
        {/* --- Sidebar (Member Selection / Statistics) --- */}
        {activeTab === 'analysis' && (
          <aside className="hidden lg:flex w-[280px] shrink-0 bg-white border-r border-slate-border flex-col p-5 overflow-y-auto">
            <div className="mb-8">
              <h3 className="text-[11px] font-bold text-slate-muted uppercase tracking-wider mb-3">Analysis Group ({analyzedMembers.length})</h3>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {members.map(member => (
                    <motion.li 
                      key={member.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-2.5 bg-slate-item rounded-lg group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input 
                          type="checkbox" 
                          checked={selectedInAnalysis.has(member.id)}
                          onChange={() => toggleSelection(member.id)}
                          className="w-4 h-4 rounded border-slate-border text-brand-blue focus:ring-brand-blue/20 cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-semibold truncate leading-tight">{member.name}</span>
                            <span className="text-[10px] font-black text-brand-blue shrink-0">{member.mbti}</span>
                            {member.birthDate && (
                              <span className="text-[9px] px-1 bg-brand-blue/5 text-brand-blue rounded font-bold shrink-0">
                                {getIlgan(member.birthDate)?.stem}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-muted truncate italic font-medium">{member.rank}</span>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <div className="mt-auto pt-6 border-t border-slate-border">
              <h3 className="text-[11px] font-bold text-slate-muted uppercase tracking-wider mb-3">Team Dynamics</h3>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-bg p-3 rounded-lg text-center">
                  <span className="block text-lg font-bold text-slate-text">{avgScore || '-'}</span>
                  <span className="text-[10px] text-slate-muted uppercase font-semibold">Avg Score</span>
                </div>
                <div className="flex-1 bg-slate-bg p-3 rounded-lg text-center">
                  <span className="block text-sm md:text-md font-bold text-slate-text truncate">
                    {glueMember ? glueMember.name : '-'}
                  </span>
                  <span className="text-[10px] text-slate-muted uppercase font-semibold">Glue Member</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* --- Main Content --- */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'analysis' && analyzedMembers.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-white border border-slate-border rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Users size={32} className="text-slate-muted" />
              </div>
              <h2 className="text-xl font-bold mb-2 font-display">Select for analysis</h2>
              <p className="text-sm text-slate-muted mb-6">You need at least 2 members to analyze team compatibility.</p>
              
              <div className="w-full lg:hidden bg-white border border-slate-border rounded-xl p-6 shadow-sm">
                <h3 className="text-[11px] font-bold text-slate-muted uppercase tracking-wider mb-4">Quick Select</h3>
                <div className="space-y-3">
                  {members.map(member => (
                    <label key={member.id} className="flex items-center gap-3 p-2 hover:bg-slate-item rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedInAnalysis.has(member.id)}
                        onChange={() => toggleSelection(member.id)}
                        className="w-5 h-5 rounded border-slate-border text-brand-blue"
                      />
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold">{member.name}</span>
                        <span className="block text-[10px] text-slate-muted">{member.rank}</span>
                      </div>
                    </label>
                  ))}
                  {members.length === 0 && <p className="text-xs italic text-slate-muted">No members found. Go to 'Management' to add team members.</p>}
                </div>
              </div>
            </div>
          ) : activeTab === 'management' ? (
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-text mb-1 font-display">Team Management</h2>
                  <p className="text-sm text-slate-muted">Edit member details or add new team members.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAiInsight(null)} // This serves as a "reset/refresh" for the analysis state
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-muted hover:text-brand-blue bg-white border border-slate-border rounded-lg transition-colors shadow-sm"
                  >
                    <RefreshCcw size={14} /> Refresh Analysis
                  </button>
                  <div className="bg-white border border-slate-border rounded-lg px-4 py-2 shadow-sm self-start">
                    <span className="text-xs font-bold text-slate-muted uppercase">Total Members: </span>
                    <span className="text-sm font-bold text-brand-blue">{members.length}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {/* Add New Member Card */}
                <motion.div
                  layout
                  className="bg-brand-blue/5 border-2 border-dashed border-brand-blue/20 rounded-xl p-5"
                >
                  <h3 className="text-[11px] font-bold text-brand-blue uppercase tracking-wider mb-3 flex items-center gap-1">
                    <UserPlus size={12} /> Register New Member
                  </h3>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <input 
                      type="text" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select 
                        value={newMbti}
                        onChange={(e) => setNewMbti(e.target.value as MBTIType)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-border bg-white"
                      >
                        {MBTI_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <select 
                        value={newRank}
                        onChange={(e) => setNewRank(e.target.value as RankType)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-border bg-white"
                      >
                        {RANKS.map(rank => <option key={rank} value={rank}>{rank}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="date"
                        value={newBirthDate}
                        onChange={(e) => setNewBirthDate(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-border bg-white focus:outline-none"
                      />
                      <input 
                        type="time"
                        value={newBirthTime}
                        onChange={(e) => setNewBirthTime(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-border bg-white focus:outline-none"
                      />
                    </div>
                    <input 
                      type="text" 
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder="Role/Department"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-border bg-white focus:outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={!newName}
                      className="w-full py-2 bg-brand-blue text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Verify & Add
                    </button>
                  </form>
                </motion.div>

                <AnimatePresence mode="popLayout">
                  {members.map(member => (
                    <motion.div
                      key={member.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-slate-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group relative"
                    >
                      {editingId === member.id ? (
                        <div className="space-y-3">
                          <input 
                            className="w-full text-sm font-bold p-1 border-b border-brand-blue focus:outline-none"
                            value={editForm?.name || ''}
                            onChange={(e) => setEditForm({ ...editForm!, name: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select 
                              className="text-xs p-1 border border-slate-border rounded"
                              value={editForm?.mbti || 'INTJ'}
                              onChange={(e) => setEditForm({ ...editForm!, mbti: e.target.value as MBTIType })}
                            >
                              {MBTI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select 
                              className="text-xs p-1 border border-slate-border rounded"
                              value={editForm?.rank || '사원'}
                              onChange={(e) => setEditForm({ ...editForm!, rank: e.target.value as RankType })}
                            >
                              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="date" 
                              className="text-xs p-1 border border-slate-border rounded"
                              value={editForm?.birthDate || ''}
                              onChange={(e) => setEditForm({ ...editForm!, birthDate: e.target.value })}
                            />
                            <input 
                              type="time" 
                              className="text-xs p-1 border border-slate-border rounded"
                              value={editForm?.birthTime || ''}
                              onChange={(e) => setEditForm({ ...editForm!, birthTime: e.target.value })}
                            />
                          </div>
                          <input 
                            className="w-full text-xs p-1 border border-slate-border rounded"
                            value={editForm?.role || ''}
                            onChange={(e) => setEditForm({ ...editForm!, role: e.target.value })}
                            placeholder="Role"
                          />
                          <div className="flex gap-2 pt-2">
                            <button onClick={saveEdit} className="grow bg-brand-blue text-white py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1">
                              <Check size={12} /> Save
                            </button>
                            <button onClick={cancelEditing} className="grow bg-slate-100 text-slate-600 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1">
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-slate-bg rounded-lg flex items-center justify-center text-brand-blue font-black text-xs">
                                {member.mbti}
                              </div>
                              {member.birthDate && (
                                <div className="px-2 py-0.5 bg-slate-bg border border-slate-border rounded-md flex flex-col items-center">
                                  <span className="text-[10px] font-black leading-none text-slate-text">{getIlgan(member.birthDate)?.stem}</span>
                                  <span className="text-[8px] text-slate-muted font-bold">일간</span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditing(member)} className="p-1.5 text-slate-muted hover:text-brand-blue hover:bg-slate-bg rounded-md">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => removeMember(member.id)} className="p-1.5 text-slate-muted hover:text-rose-500 hover:bg-rose-50 rounded-md">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <h4 className="font-bold text-slate-text">{member.name}</h4>
                          <p className="text-[11px] text-slate-muted font-semibold uppercase tracking-wider mb-2">{member.rank}</p>
                          <div className="text-xs text-slate-muted truncate">
                            {member.role || 'No specific role'}
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                  <motion.div
                    layout
                    className="border-2 border-dashed border-slate-border rounded-xl p-5 flex flex-col items-center justify-center text-slate-muted hover:border-brand-blue hover:text-brand-blue transition-colors cursor-pointer"
                    onClick={() => {
                      document.getElementById('name-input')?.focus();
                      // Or just keep the sidebar always visible for now
                    }}
                  >
                    <UserPlus size={24} className="mb-2" />
                    <span className="text-xs font-bold">Add New Member</span>
                    <span className="text-[10px] text-center mt-1">Use sidebar to register</span>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          ) : members.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-white border border-slate-border rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Users size={32} className="text-slate-muted" />
              </div>
              <h2 className="text-xl font-bold mb-2">Build your team</h2>
              <p className="text-sm text-slate-muted">Register at least 2 members in the sidebar to begin the compatibility analysis.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
              {/* Left Column: Heatmap */}
              <div className="space-y-6">
                <div className="bg-white border border-slate-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-[11px] font-bold text-slate-muted uppercase tracking-wider mb-6">Compatibility Heatmap</h3>
                  
                  <div className="overflow-x-auto pb-4 custom-scrollbar flex flex-col items-center">
                    <div className="min-w-max">
                      <div className="grid" style={{ gridTemplateColumns: `auto repeat(${analyzedMembers.length}, 44px)` }}>
                        <div className="w-20" />
                        {analyzedMembers.map(m => (
                          <div key={m.id} className="w-[44px] h-10 flex items-center justify-center text-[10px] font-bold text-slate-muted uppercase">
                            {m.name.substring(0, 2).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      {analyzedMembers.map((m1, i) => (
                        <div key={m1.id} className="grid" style={{ gridTemplateColumns: `auto repeat(${analyzedMembers.length}, 44px)` }}>
                          <div className="w-20 h-[44px] flex items-center text-[10px] font-bold text-slate-muted uppercase truncate pr-4">
                            {m1.name}
                          </div>
                          {analyzedMembers.map((m2, j) => {
                            const res = matrix[i][j];
                            const isActive = selectedPair?.[0] === m1.id && selectedPair?.[1] === m2.id;
                            const isSelf = m1.id === m2.id;
                            
                            if (isSelf) {
                              return (
                                <div
                                  key={`${m1.id}-${m2.id}`}
                                  className="w-10 h-10 m-0.5 rounded-md flex items-center justify-center bg-slate-bg border border-slate-item text-slate-muted animate-pulse/0 transition-all opacity-40 cursor-not-allowed"
                                >
                                  <X size={12} />
                                </div>
                              );
                            }

                            return (
                              <button
                                key={`${m1.id}-${m2.id}`}
                                onClick={() => setSelectedPair([m1.id, m2.id])}
                                className={`w-10 h-10 m-0.5 rounded-md flex items-center justify-center text-[11px] font-bold transition-all relative
                                  ${getScoreClass(res.score)}
                                  ${isActive ? 'ring-2 ring-brand-blue ring-offset-1 z-10' : 'hover:scale-105'}
                                `}
                              >
                                {res.score}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-8 pt-4 border-t border-slate-item text-[11px] text-slate-muted leading-relaxed">
                    * High compatibility indicates smooth initial interaction, while lower scores might suggest areas for intentional growth and diverse perspectives.
                  </div>
                </div>

                {/* Mobile Stats Summary */}
                <div className="lg:hidden grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-border rounded-xl p-4 shadow-sm text-center">
                    <span className="block text-2xl font-black text-brand-blue leading-none mb-1">{avgScore || '0'}</span>
                    <span className="text-[10px] text-slate-muted uppercase font-bold tracking-wider">Avg Compatibility</span>
                  </div>
                  <div className="bg-white border border-slate-border rounded-xl p-4 shadow-sm text-center">
                    <span className="block text-xl font-black text-brand-blue leading-none mb-1 truncate">
                      {glueMember ? glueMember.name : '-'}
                    </span>
                    <span className="text-[10px] text-slate-muted uppercase font-bold tracking-wider">Glue Member</span>
                  </div>
                </div>

                {/* AI Insight (Secondary location if sidebar detail pane is hidden/small) */}
                <div className="xl:hidden">
                  <AIInsightBox 
                    aiInsight={aiInsight} 
                    isAiLoading={isAiLoading} 
                    onGenerate={generateAIInsight} 
                    currentTab={reportTab}
                    onTabChange={setReportTab}
                  />
                </div>
              </div>

              {/* Right Column: Details & AI */}
              <div className="space-y-6 flex flex-col">
                <AnimatePresence mode="wait">
                  {selectedPair ? (
                    <motion.div
                      key={selectedPair.join('-')}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-white border border-slate-border rounded-xl p-6 shadow-sm flex flex-col min-h-[500px]"
                    >
                      <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                        {(['summary', 'mbti', 'saju'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setPairTab(t)}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${pairTab === t ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-muted hover:text-slate-600'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const m1 = analyzedMembers.find(m => m.id === selectedPair[0]);
                        const m2 = analyzedMembers.find(m => m.id === selectedPair[1]);
                        if (!m1 || !m2) return (
                          <div className="p-8 text-center text-xs text-slate-muted">Selected members are no longer in the analysis set.</div>
                        );
                        const res = calculateCompatibility(m1, m2);
                        
                        return (
                          <div className="flex flex-col h-full">
                            <AnimatePresence mode="wait">
                              {pairTab === 'summary' && (
                                <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                                  <div className="text-center mb-6">
                                    <div className="text-sm font-bold flex items-center justify-center gap-2 mb-1">
                                      {m1.name} <span className="text-slate-muted">&</span> {m2.name}
                                    </div>
                                    <div className="text-[11px] font-medium text-slate-muted uppercase tracking-wide">
                                      Overall Harmony
                                    </div>
                                  </div>
                                  
                                  <div className="w-24 h-24 rounded-full border-[4px] border-brand-blue flex flex-col items-center justify-center mx-auto mb-8 text-brand-blue shadow-sm">
                                    <span className="text-3xl font-black leading-none">{res.score}</span>
                                  </div>

                                  {res.rankInsight && (
                                    <div className="w-full p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                                      <h4 className="text-[10px] font-black text-amber-700 uppercase mb-1 flex items-center gap-1">
                                        <Sparkles size={12} /> Hierarchy Insight
                                      </h4>
                                      <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                        {res.rankInsight}
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              )}

                              {pairTab === 'mbti' && (
                                <motion.div key="mbti" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                  <div className="text-center mb-4">
                                    <div className="inline-flex gap-2 items-center justify-center">
                                      <span className="bg-brand-blue text-white text-[10px] font-black px-2 py-0.5 rounded">{m1.mbti}</span>
                                      <span className="text-slate-muted font-bold">&</span>
                                      <span className="bg-brand-blue text-white text-[10px] font-black px-2 py-0.5 rounded">{m2.mbti}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-3">Synergy Points</span>
                                    <ul className="text-xs text-slate-text leading-relaxed space-y-2 list-disc pl-3">
                                      {res.synergy.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                  </div>
                                  <div>
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 text-[10px] font-bold uppercase tracking-wider mb-3">Conflict Patterns</span>
                                    <ul className="text-xs text-slate-text leading-relaxed space-y-2 list-disc pl-3">
                                      {res.caution.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                  </div>
                                </motion.div>
                              )}

                              {pairTab === 'saju' && (
                                <motion.div key="saju" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                  <div className="flex justify-center gap-4 mb-4">
                                    {[{m: m1, label: 'M1'}, {m: m2, label: 'M2'}].map(({m, label}) => {
                                      const ilgan = getIlgan(m.birthDate);
                                      return (
                                        <div key={label} className="text-center">
                                          <div className="w-12 h-12 bg-slate-bg border-2 border-slate-border rounded-xl flex items-center justify-center text-lg font-black text-slate-text mb-1 relative group">
                                            {ilgan ? ilgan.stem : '?'}
                                            {ilgan && (
                                              <span className="absolute -top-2 -right-2 text-[8px] bg-slate-text text-white px-1.5 rounded-full border border-white">
                                                {ilgan.element.charAt(0)}
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] font-bold text-slate-muted">{m.name}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  <div className="p-4 bg-slate-bg border border-slate-border rounded-xl">
                                    <h4 className="text-[10px] font-black text-brand-blue uppercase mb-2">Energy Matching</h4>
                                    <p className="text-[11px] text-slate-text leading-relaxed font-medium">
                                      {res.sajuInsight || '생년월일 정보가 입력되지 않아 일간 분석이 불가능합니다.'}
                                    </p>
                                  </div>

                                  <div className="text-[10px] text-slate-muted leading-relaxed">
                                    * 일간(日干) 분석은 본인의 타고난 기질과 타인과의 에너지 호환성을 판단하는 사주명리학의 기초적인 분석입니다.
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            
                            <div className="mt-auto pt-6 border-t border-slate-item text-center">
                              <p className="text-[11px] italic text-slate-muted">"Integration of Psychology & Tradition"</p>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  ) : (
                    <div className="bg-white border border-slate-border border-dashed rounded-xl p-12 text-center shadow-sm">
                      <p className="text-xs text-slate-muted">Select a cell in the heatmap to see pair details (Summary/MBTI/Saju).</p>
                    </div>
                  )}
                </AnimatePresence>

                <div className="hidden xl:block">
                  <AIInsightBox 
                    aiInsight={aiInsight} 
                    isAiLoading={isAiLoading} 
                    onGenerate={generateAIInsight} 
                    currentTab={reportTab}
                    onTabChange={setReportTab}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- Mobile Install Modal --- */}
      <AnimatePresence>
        {showMobileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileModal(false)}
              className="absolute inset-0 bg-slate-text/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-brand-blue p-8 text-white text-center pb-20">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                  <Share2 size={32} />
                </div>
                <h3 className="text-xl font-black mb-2">TeamFit Mobile</h3>
                <p className="text-white/80 text-sm leading-relaxed">Scan to open on your phone and install as a native-feeling app.</p>
              </div>
              
              <div className="p-8 -mt-12">
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-border flex flex-col items-center">
                  <div className="bg-slate-bg p-3 rounded-xl mb-4 border border-slate-border">
                    <QRCodeSVG 
                      value={window.location.href} 
                      size={180}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-[10px] font-black text-slate-muted uppercase tracking-widest mb-6">Scan QR Code</p>
                  
                  <div className="w-full space-y-4 text-left">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 shrink-0 bg-slate-bg rounded-full flex items-center justify-center text-[10px] font-black text-brand-blue border border-slate-border">1</div>
                      <p className="text-xs text-slate-text font-medium">QR 코드를 스캔하여 모바일 기기에서 엽니다.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 shrink-0 bg-slate-bg rounded-full flex items-center justify-center text-[10px] font-black text-brand-blue border border-slate-border">2</div>
                      <p className="text-xs text-slate-text font-medium">브라우저 메뉴에서 <span className="text-brand-blue font-bold">'홈 화면에 추가'</span>를 누르세요.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 shrink-0 bg-slate-bg rounded-full flex items-center justify-center text-[10px] font-black text-brand-blue border border-slate-border">3</div>
                      <p className="text-xs text-slate-text font-medium">바탕화면에 앱 아이콘이 생성되어 네이티브 앱처럼 사용할 수 있습니다.</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowMobileModal(false)}
                  className="w-full mt-6 py-3 bg-slate-item text-slate-text font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AIInsightBox({ aiInsight, isAiLoading, onGenerate, currentTab, onTabChange }: { 
  aiInsight: string | null, 
  isAiLoading: boolean, 
  onGenerate: () => void,
  currentTab: 'summary' | 'mbti' | 'saju',
  onTabChange: (t: 'summary' | 'mbti' | 'saju') => void
}) {
  const getSection = (text: string, tab: string) => {
    if (!text) return null;
    const tagMap: Record<string, string> = {
      summary: '[요약]',
      mbti: '[MBTI 분석]',
      saju: '[사주 분석]'
    };
    const tag = tagMap[tab];
    const sections = text.split(/\[.*?\]/);
    const tags = (text.match(/\[.*?\]/g) || []) as string[];
    
    const index = tags.indexOf(tag);
    if (index === -1) return text; // Fallback if tags are missing

    return sections[index + 1]?.trim() || "분석 결과를 불러오는 중입니다...";
  };

  return (
    <div className="bg-white border border-slate-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold text-slate-muted uppercase tracking-wider">AI Insight</h3>
        {!aiInsight && !isAiLoading && (
          <button 
            onClick={onGenerate}
            className="text-[11px] font-bold text-brand-blue hover:underline flex items-center gap-1"
          >
            <Sparkles size={12} /> Generate
          </button>
        )}
      </div>

      {aiInsight && !isAiLoading && (
        <div className="flex bg-slate-item p-1 rounded-lg mb-4">
          {(['summary', 'mbti', 'saju'] as const).map(t => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`flex-1 py-1 text-[9px] font-black uppercase rounded-md transition-all ${currentTab === t ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-muted hover:text-slate-text'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      
      {isAiLoading ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <RefreshCcw className="animate-spin text-brand-blue" size={20} />
          <p className="text-[11px] font-medium text-slate-muted">Analyzing team dynamics...</p>
        </div>
      ) : aiInsight ? (
        <div className="space-y-4">
          <div className="text-[12px] text-slate-text leading-relaxed font-medium overflow-y-auto max-h-[300px] custom-scrollbar">
            {getSection(aiInsight, currentTab).split('\n').map((line, i) => (
              <p key={i} className={`mb-2 ${line.startsWith('#') ? 'font-bold text-brand-blue border-l-2 border-brand-blue pl-2' : ''}`}>
                {line.replace(/^#+\s/, '')}
              </p>
            ))}
          </div>
          <button 
            onClick={onGenerate}
            className="w-full py-1.5 border border-slate-border rounded-md text-[10px] font-bold text-slate-muted hover:bg-slate-item transition-colors"
          >
            Regenerate Report
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-slate-muted italic">
          Click generate to get a deep AI analysis combining MBTI and Saju dynamics.
        </p>
      )}
    </div>
  );
}
