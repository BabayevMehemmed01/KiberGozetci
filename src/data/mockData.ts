import type { AttackPoint, Employee, FeedEvent, PhishingTemplate, VoiceSample } from "../types.ts";
import { formatDay } from "../lib/utils.ts";

export const RASHAD_ID = "rashad-aliyev";

export const employees: Employee[] = [
  {
    id: RASHAD_ID,
    firstName: "Rəşad",
    lastName: "Əliyev",
    position: "Baş Mühasib",
    department: "Maliyyə",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 15,
    awarenessScore: 72,
    lastTestResult: "Təcili ödəniş linkinə kliklədi",
    lastTestStatus: "ugursuz",
    status: "Nəzarətdə",
    email: "rashad.aliyev@azersanaye.example",
  },
  {
    id: "nigar-mammadova",
    firstName: "Nigar",
    lastName: "Məmmədova",
    position: "Maliyyə Direktoru",
    department: "Maliyyə",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 8,
    awarenessScore: 95,
    lastTestResult: "Şübhəli məktubu dərhal bildirdi",
    lastTestStatus: "ugurlu",
    status: "Aktiv",
    email: "nigar.mammadova@azersanaye.example",
  },
  {
    id: "elvin-hasanov",
    firstName: "Elvin",
    lastName: "Həsənov",
    position: "İT Administrator",
    department: "İnformasiya Texnologiyaları",
    workStart: "08:30",
    workEnd: "17:30",
    avgDailyDownloads: 18,
    awarenessScore: 91,
    lastTestResult: "Saxta admin panelini tanıdı",
    lastTestStatus: "ugurlu",
    status: "Aktiv",
    email: "elvin.hasanov@azersanaye.example",
  },
  {
    id: "aysel-guliyeva",
    firstName: "Aysel",
    lastName: "Quliyeva",
    position: "Satış Meneceri",
    department: "Satış",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 14,
    awarenessScore: 84,
    lastTestResult: "Keçidi açdı, məlumat daxil etmədi",
    lastTestStatus: "qismen",
    status: "Aktiv",
    email: "aysel.quliyeva@azersanaye.example",
  },
  {
    id: "kamran-ibrahimov",
    firstName: "Kamran",
    lastName: "İbrahimov",
    position: "HR Mütəxəssisi",
    department: "İnsan Resursları",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 9,
    awarenessScore: 91,
    lastTestResult: "Saxta CV linkini bildirdi",
    lastTestStatus: "ugurlu",
    status: "Aktiv",
    email: "kamran.ibrahimov@azersanaye.example",
  },
  {
    id: "leyla-huseynova",
    firstName: "Leyla",
    lastName: "Hüseynova",
    position: "Hüquqşünas",
    department: "Hüquq",
    workStart: "09:30",
    workEnd: "18:30",
    avgDailyDownloads: 6,
    awarenessScore: 97,
    lastTestResult: "Bütün sınaq göstəricilərini tanıdı",
    lastTestStatus: "ugurlu",
    status: "Aktiv",
    email: "leyla.huseynova@azersanaye.example",
  },
  {
    id: "tural-babayev",
    firstName: "Tural",
    lastName: "Babayev",
    position: "Satınalma Mütəxəssisi",
    department: "Satınalma",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 11,
    awarenessScore: 69,
    lastTestResult: "Saxta faktura məktubunu açdı",
    lastTestStatus: "ugursuz",
    status: "Nəzarətdə",
    email: "tural.babayev@azersanaye.example",
  },
  {
    id: "orxan-valiyev",
    firstName: "Orxan",
    lastName: "Vəliyev",
    position: "Sistem Analitiki",
    department: "İnformasiya Texnologiyaları",
    workStart: "10:00",
    workEnd: "19:00",
    avgDailyDownloads: 16,
    awarenessScore: 88,
    lastTestResult: "OTP tələbini rədd etdi",
    lastTestStatus: "ugurlu",
    status: "Aktiv",
    email: "orxan.valiyev@azersanaye.example",
  },
  {
    id: "aygun-rzayeva",
    firstName: "Aygün",
    lastName: "Rzayeva",
    position: "Daxili Auditor",
    department: "Daxili Audit",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 5,
    awarenessScore: 99,
    lastTestResult: "Ssenarinin hər üç əlamətini göstərdi",
    lastTestStatus: "ugurlu",
    status: "Aktiv",
    email: "aygun.rzayeva@azersanaye.example",
  },
  {
    id: "fuad-nasirov",
    firstName: "Fuad",
    lastName: "Nəsirov",
    position: "Anbar Müdiri",
    department: "Logistika",
    workStart: "08:00",
    workEnd: "17:00",
    avgDailyDownloads: 7,
    awarenessScore: 55,
    lastTestResult: "Gecə saatı kütləvi ixrac",
    lastTestStatus: "ugursuz",
    status: "Dondurulub",
    email: "fuad.nasirov@azersanaye.example",
  },
  {
    id: "cavid-gasimov",
    firstName: "Cavid",
    lastName: "Qasımov",
    position: "Kiçik Mühasib",
    department: "Maliyyə",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 13,
    awarenessScore: 46,
    lastTestResult: "Birdəfəlik kodu səsli zəngdə dedi",
    lastTestStatus: "ugursuz",
    status: "Dondurulub",
    email: "cavid.gasimov@azersanaye.example",
  },
  {
    id: "rena-ismayilova",
    firstName: "Rəna",
    lastName: "İsmayılova",
    position: "Ofis Administratoru",
    department: "İnzibati İşlər",
    workStart: "09:00",
    workEnd: "18:00",
    avgDailyDownloads: 10,
    awarenessScore: 49,
    lastTestResult: "Saxta kuryer keçidini açdı",
    lastTestStatus: "ugursuz",
    status: "Dondurulub",
    email: "rena.ismayilova@azersanaye.example",
  },
];

const ATTACK_VALUES = [
  { Fişinq: 14, Dipfeyk: 1, "Daxili anomaliya": 2 },
  { Fişinq: 18, Dipfeyk: 2, "Daxili anomaliya": 1 },
  { Fişinq: 16, Dipfeyk: 2, "Daxili anomaliya": 3 },
  { Fişinq: 22, Dipfeyk: 3, "Daxili anomaliya": 2 },
  { Fişinq: 19, Dipfeyk: 2, "Daxili anomaliya": 4 },
  { Fişinq: 24, Dipfeyk: 4, "Daxili anomaliya": 3 },
  { Fişinq: 21, Dipfeyk: 5, "Daxili anomaliya": 6 },
] as const;

export function buildAttackTrend(now = new Date()): AttackPoint[] {
  return ATTACK_VALUES.map((row, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (ATTACK_VALUES.length - 1 - index));
    return { day: formatDay(date), ...row };
  });
}

export const threatJournal: FeedEvent[] = [
  {
    id: "j1",
    time: "08:14:22",
    title: "Saxta vergi cəriməsi bloklandı",
    detail: "Maliyyə qrupuna göndərilən .xyz keçidi karantinə alındı.",
    severity: "critical",
    category: "Fişinq",
    source: "history",
  },
  {
    id: "j2",
    time: "08:41:05",
    title: "Klonlanmış direktor səsi dayandırıldı",
    detail: "Rəşad Əliyevə gələn dipfeyk səs mesajı 2-ci qatda saxlanıldı.",
    severity: "critical",
    category: "Dipfeyk",
    source: "history",
  },
  {
    id: "j3",
    time: "09:06:48",
    title: "Saxta kuryer keçidi təcrid olundu",
    detail: "Rəna İsmayılovanın poçtunda IP ünvanlı keçid bloklandı.",
    severity: "warning",
    category: "Fişinq",
    source: "history",
  },
  {
    id: "j4",
    time: "10:22:11",
    title: "Kiber-sayıqlıq sınağı göndərildi",
    detail: "Satış şöbəsinə planlı fişinq sınağı çatdırıldı.",
    severity: "success",
    category: "Sistem",
    source: "history",
  },
  {
    id: "j5",
    time: "11:47:33",
    title: "İş saatından kənar 420 fayl",
    detail: "Cavid Qasımovun hesabında anomal ixrac izi qeydə alındı.",
    severity: "critical",
    category: "Daxili anomaliya",
    source: "history",
  },
  {
    id: "j6",
    time: "13:18:09",
    title: "OTP tələb edən mesaj bloklandı",
    detail: "Birdəfəlik kod istəyən məktub avtomatik karantinə düşdü.",
    severity: "warning",
    category: "Fişinq",
    source: "history",
  },
  {
    id: "j7",
    time: "14:55:40",
    title: "Robotik harmonikalı səs rədd edildi",
    detail: "Vocoder izi daşıyan fayl dipfeyk növbəsindən çıxarıldı.",
    severity: "warning",
    category: "Dipfeyk",
    source: "history",
  },
  {
    id: "j8",
    time: "16:27:18",
    title: "Anbar hesabında gecə ixracı",
    detail: "Fuad Nəsirovun sessiyası dondurulmuş vəziyyətdə izlənilir.",
    severity: "critical",
    category: "Daxili anomaliya",
    source: "history",
  },
];

export const liveTemplates: Omit<FeedEvent, "id" | "time" | "source">[] = [
  {
    title: "Yeni fişinq məktubu bloklandı",
    detail: "«Hesabınız bloklanacaq» mövzusunda təcili məktub karantinə alındı.",
    technical: "Mövzu xətti təcililik leksikonuna düşdü. Keçid reputasiya siyahısındadır və gövdə karantinə köçürüldü.",
    sourceIp: "185.203.44.12",
    mitre: "T1566.002 — Spearphishing Link",
    severity: "warning",
    category: "Fişinq",
  },
  {
    title: "Dipfeyk zəngi kəsildi",
    detail: "Klonlanmış rəhbər səsi ilə gələn zəng 2-ci qatda dayandırıldı.",
    technical: "Səs izində steril pauza və sabit harmonik sıxlıq ölçüldü. Zəng media şlüzündə kəsildi.",
    sourceIp: "91.132.45.17",
    mitre: "T1656 — Impersonation / Deepfake",
    severity: "critical",
    category: "Dipfeyk",
  },
  {
    title: "Şübhəli .top keçidi təcrid olundu",
    detail: "Köçürmə təsdiqi görünümlü domen poçt şlüzündə saxlanıldı.",
    technical: ".top TLD və ödəniş sözləri birlikdə yüksək domen balı verdi. DNS sorğusu bloklandı.",
    sourceIp: "45.138.16.204",
    mitre: "T1566.002 — Spearphishing Link",
    severity: "warning",
    category: "Fişinq",
  },
  {
    title: "Kütləvi yükləmə cəhdi dayandırıldı",
    detail: "Gündəlik limitdən kənar ixrac sorğusu avtomatik kəsildi.",
    technical: "Sessiya gündəlik fayl normasını bir neçə dəqiqəyə keçdi. İxrac növbəsi dayandırıldı.",
    sourceIp: "185.203.15.88",
    mitre: "T1048 — Exfiltration Over Alternative Protocol",
    severity: "critical",
    category: "Daxili anomaliya",
  },
  {
    title: "Cərimə bildirişi karantinə düşdü",
    detail: "Vergi orqanı adından gələn təzyiq məktubu bloklandı.",
    technical: "Göndərən domen rəsmi zona ilə uyğun gəlmir. Məktub istifadəçiyə çatdırılmadı.",
    sourceIp: "185.203.41.23",
    mitre: "T1566.002 — Spearphishing Link",
    severity: "warning",
    category: "Fişinq",
  },
  {
    title: "Səs faylında vocoder izi",
    detail: "Yüklənən yazının tezlik spektri sintez kimi qiymətləndirildi.",
    technical: "Yüksək tezlik kəsilməsi və nəfəs fasiləsinin olmaması süni sintez qoluna düşdü.",
    sourceIp: "185.203.44.19",
    mitre: "T1656 — Impersonation / Deepfake",
    severity: "warning",
    category: "Dipfeyk",
  },
];

export const phishingTemplates: PhishingTemplate[] = [
  {
    id: "vergi",
    title: "Saxta vergi cəriməsi",
    description: "Təhlükəli bank və vergi mesajı",
    tone: "tehlukeli",
    text: "Hörmətli müştəri,\n\nVergi öhdəliyiniz üzrə 1.850 AZN cərimə tətbiq olunub. Hesabınız 2 saat ərzində bloklanacaq. Dərhal təcili ödəniş edin və şifrənizi yeniləyin. Əks halda kartınız dondurulacaq.",
    url: "http://vergi-teyid-merkezi.xyz/hesabiniz",
  },
  {
    id: "rehber",
    title: "Rəhbər adından köçürmə",
    description: "Təcili ödəniş təzyiqi",
    tone: "tehlukeli",
    text: "Rəşad, mən indi iclasdayam. Hesabınızdan 24.000 AZN məbləğində təcili köçürməni dərhal göndər. Heç kimə demə, təsdiqi sonra edərik.",
    url: "http://maliyye-kocurme.top/teyid",
  },
  {
    id: "kuryer",
    title: "Saxta kuryer keçidi",
    description: "Bağlama və FİN kodu tələbi",
    tone: "tehlukeli",
    text: "Sifarişiniz çatdırılma məntəqəsində saxlanılır. Bağlamanı itirməmək üçün təcili təsdiq lazımdır. Ünvanı təsdiqləmək üçün dərhal keçidə klikləyin, əks halda bağlama geri qaytarılacaq. Davam etmək üçün şifrənizi və FİN kodunuzu daxil edin.",
    url: "http://185.203.44.12/kuryer-teyid",
  },
  {
    id: "resmi",
    title: "Rəsmi daxili məktub",
    description: "100% təhlükəsiz nümunə",
    tone: "tehlukesiz",
    text: "Hörmətli həmkarlar,\n\nSabah saat 11:00-da iclas zalında rüblük maliyyə hesabatı müzakirə olunacaq. Materiallar daxili portala yerləşdirilib. İştirakınız xahiş olunur.\n\nHörmətlə,\nNigar Məmmədova\nMaliyyə Direktoru",
    url: "https://portal.sirket.az/hesabatlar/2026-q3",
  },
  {
    id: "ceo-en",
    title: "CEO Fraud — EN",
    description: "İngilis dilində təcili köçürmə",
    tone: "tehlukeli",
    text: "Hi Rashad,\n\nThis is urgent. I am in a board meeting and need you to wire transfer $24,000 immediately. Do not tell anyone. Verify now. Card for the vendor: 4242 4242 4242 4242. Password can wait.",
    url: "http://secure-wire-update.xyz/verify-now",
  },
  {
    id: "bank-ru",
    title: "Bank Təhlükəsizlik — RU",
    description: "Rus dilində hesab blokajı",
    tone: "tehlukeli",
    text: "Уважаемый клиент!\n\nВаш счет заблокирован. Срочно подтвердите личность и выполните перевод. Код подтверждения: 849221. В противном случае доступ будет закрыт немедленно!!!",
    url: "http://bank-bezopasnost.click/kod",
  },
];

export const voiceSamples: VoiceSample[] = [
  {
    id: "boss",
    fileName: "rehber_tecili_kocurme_deepfake.mp3",
    title: "Rəhbər — təcili köçürmə",
    description: "Sintezləşdirilmiş süni səs tezlikləri",
    scene: "Səs mesajı",
  },
  {
    id: "report",
    fileName: "maliyye_hesabat_heqiqi.ogg",
    title: "Maliyyə hesabatı",
    description: "Təbii səs modulyasiyası",
    scene: "İclas qeydi",
  },
  {
    id: "otp",
    fileName: "namelum_otp_telebi_deepfake.mp3",
    title: "Naməlum — OTP tələbi",
    description: "Süni robotik harmonikalar",
    scene: "Zəng yazısı",
  },
];

export interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  track: "maliyye" | "it" | "diger";
  prompt: string;
  options: QuizOption[];
  explain: string;
}

export function quizTrack(department: string): QuizQuestion["track"] {
  const folded = department.toLocaleLowerCase("az-AZ");
  if (folded.includes("maliyyə") || folded.includes("maliyye")) return "maliyye";
  if (folded.includes("texnolog") || folded.includes("informasiya")) return "it";
  return "diger";
}

export function questionsFor(department: string): QuizQuestion[] {
  const track = quizTrack(department);
  return quizQuestions.filter((question) => question.track === track);
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: "fin-1",
    track: "maliyye",
    prompt:
      "Maliyyə direktorunun adından gələn mesajda «təcili köçürmə et, heç kimə demə» yazılır və tanış olmayan keçid var. Ən düzgün addım hansıdır?",
    options: [
      { id: "a", text: "Gecikməsin deyə köçürməni dərhal göndərmək", correct: false },
      {
        id: "b",
        text: "Keçidə girməmək, mesajı şübhəli bildirmək və rəhbərdən rəsmi kanalla təsdiq almaq",
        correct: true,
      },
      { id: "c", text: "Keçidi açmaq, amma şifrəni yazmamaq", correct: false },
    ],
    explain: "Tələskənlik, gizlilik təzyiqi və kənar keçid birlikdə fişinq əlamətidir. Ödəniş yalnız təsdiqlənmiş daxili kanalla aparılır.",
  },
  {
    id: "fin-2",
    track: "maliyye",
    prompt: "Təchizatçı tanış e-poçtdan yazır və hesab-fakturanın IBAN-ını «bank yeniləməsi» adı ilə dəyişdirməyinizi istəyir. Nə edirsiniz?",
    options: [
      { id: "a", text: "Köhnə ödəniş şablonunu dərhal yeni IBAN ilə əvəz etmək", correct: false },
      { id: "b", text: "Ödənişi dayandırmaq və IBAN-ı müqavilədəki rəsmi kanalla yoxlamaq", correct: true },
      { id: "c", text: "Kiçik məbləğdə sınaq köçürməsi edib nəticəyə baxmaq", correct: false },
    ],
    explain: "IBAN dəyişikliyi klassik ödəniş yönləndirmə hücumudur. Yeni hesab yalnız müqavilə və tanınmış telefonla təsdiqlənir.",
  },
  {
    id: "fin-3",
    track: "maliyye",
    prompt: "Tanış səs maliyyə əməliyyatı üçün birdəfəlik bank kodunu sizdən istəyir. Bunu necə qiymətləndirirsiniz?",
    options: [
      { id: "a", text: "Səs rəhbərə bənzəyirsə, kodu demək olar", correct: false },
      { id: "b", text: "Bu, dipfeyk ola bilər. Birdəfəlik kod heç vaxt səslə paylaşılmır", correct: true },
      { id: "c", text: "Kodu yalnız bir dəfə və qısa şəkildə demək olar", correct: false },
    ],
    explain: "Süni səs real insanı inandırıcı təqlid edə bilir. Birdəfəlik kod yalnız sizin ekranınızdakı rəsmi əməliyyata aiddir.",
  },
  {
    id: "it-1",
    track: "it",
    prompt: "Xarici ünvanlı bilet administrator şifrəsinin «təcili sıfırlanmasını» və keçiddən daxil olmanızı istəyir. İlk addım nədir?",
    options: [
      { id: "a", text: "Keçidi açıb inzibatçı şifrəsini yeniləmək", correct: false },
      { id: "b", text: "Bileti saxta hesab etmək, keçidə girməmək və daxili tiket sistemindən yoxlamaq", correct: true },
      { id: "c", text: "Şifrəni həmkarla çatda paylaşmaq", correct: false },
    ],
    explain: "İnzibatçı şifrəsi heç vaxt e-poçt keçidi ilə sıfırlanmır. Sorğu yalnız daxili tiket və tanınmış identifikasiya ilə qəbul edilir.",
  },
  {
    id: "it-2",
    track: "it",
    prompt: "Masaya naməlum USB yaddaş qoyulub və üzərində «şəbəkə yeniləməsi» yazılıb. Necə davranırsınız?",
    options: [
      { id: "a", text: "İş kompüterinə taxıb içindəki faylı işə salmaq", correct: false },
      { id: "b", text: "Cihazı qoşmamaq, təhlükəsizlik komandasına təhvil vermək", correct: true },
      { id: "c", text: "Əvvəlcə şəxsi noutbukda açmaq", correct: false },
    ],
    explain: "Naməlum daşıyıcı zərərli proqramın ən köhnə yoludur. Heç bir iş və ya şəxsi kompüterə taxılmır.",
  },
  {
    id: "it-3",
    track: "it",
    prompt: "Söhbət pəncərəsində rəhbər adından VPN istifadəçi adı və birdəfəlik kod istənilir. Düzgün reaksiya hansıdır?",
    options: [
      { id: "a", text: "Kodun müddəti bitməsin deyə dərhal göndərmək", correct: false },
      { id: "b", text: "Kodu paylaşmamaq, sessiyanı bağlamaq və müraciəti rəsmi kanaldan təsdiqləmək", correct: true },
      { id: "c", text: "Yalnız istifadəçi adını göndərib kodu gizlətmək", correct: false },
    ],
    explain: "VPN məlumatı və birdəfəlik kod identifikasiyanın açarıdır. Çat yazısı, hətta tanış addan gəlsə belə, sübut deyil.",
  },
  {
    id: "ops-1",
    track: "diger",
    prompt: "Kuryer xidmətindən gələn SMS bağlamanı itirməmək üçün qısa keçidə keçməyinizi və FİN kod yazmağınızı istəyir. Nə edirsiniz?",
    options: [
      { id: "a", text: "Keçidi açıb FİN kodu daxil etmək", correct: false },
      { id: "b", text: "Keçidə girməmək və çatdırılmanı rəsmi tətbiq və ya tanınmış nömrə ilə yoxlamaq", correct: true },
      { id: "c", text: "Keçidi həmkarlara yönləndirmək", correct: false },
    ],
    explain: "Saxta kuryer keçidi FİN və kart məlumatını oğurlamaq üçün qurulur. İzləmə yalnız rəsmi tətbiqdə aparılır.",
  },
  {
    id: "ops-2",
    track: "diger",
    prompt: "Bir iş hesabı gecə 02:30-da gündəlik limitdən qat-qat çox müştəri qeydini ixrac edir. İlk reaksiya nədir?",
    options: [
      { id: "a", text: "Səhər növbəsinə qədər gözləmək", correct: false },
      { id: "b", text: "Hesabı dərhal dondurmaq, ixracı dayandırmaq və hadisəni jurnala salmaq", correct: true },
      { id: "c", text: "Faylları əlavə nüsxə üçün başqa qovluğa köçürmək", correct: false },
    ],
    explain: "Bu, normal davranışdan kəskin sapmadır. Dondurma sızmanı saniyələr içində kəsir, jurnal isə üç müdafiə qatını bir-birinə bağlayır.",
  },
  {
    id: "ops-3",
    track: "diger",
    prompt: "Ümumi poçt qutusuna «anbar siyahısı» adlı qoşma gəlir və makrosu aktiv etmədən açılmadığı yazılır. Necə yanaşırsınız?",
    options: [
      { id: "a", text: "Makrosu aktiv edib cədvələ baxmaq", correct: false },
      { id: "b", text: "Qoşmanı açmamaq, göndərəni təsdiqləmək və şübhəli faylı bildirmək", correct: true },
      { id: "c", text: "Faylı şəxsi poçta ötürüb orada açmaq", correct: false },
    ],
    explain: "Makros istəyən gözlənilməz qoşma zərərli proqram daşıyıcısıdır. Fayl yalnız göndərən təsdiqləndikdən və təhlükəsiz mühitdə açılır.",
  },
];
