// Types d'incidents et échelle de sanctions issus du Cahier de Procédures (DVS, v17/06/26),
// Section II Partie 2 — Procédures Disciplinaires (Généralités + Fiches PD-01 à PD-17).

// Avertissement et Exclusion sont scindés en deux niveaux de gravité croissante (verbal/écrit,
// interne/externe) — le cahier d'origine ne distinguait qu'un seul niveau pour chacun. Les
// entrées disciplinaires déjà enregistrées avec les anciens libellés ("Avertissement", "Exclusion")
// restent stockées telles quelles (champ texte libre) et ne sont pas requalifiées rétroactivement.
export const SANCTION_LEVELS = [
  'Avertissement verbal',
  'Avertissement écrit',
  'Blâme',
  'Retenue',
  "Travaux d'intérêt général",
  'Privation d’activités périscolaires/sportives',
  'Engagement parental',
  'Exclusion interne',
  'Exclusion externe',
  'Conseil de discipline',
  'Exclusion définitive',
] as const
export type SanctionLevel = (typeof SANCTION_LEVELS)[number]

/** Points retirés de la note de conduite selon le niveau de sanction retenu. */
export const SANCTION_POINTS: Record<SanctionLevel, number> = {
  'Avertissement verbal': 0,
  'Avertissement écrit': -1,
  Blâme: -2,
  Retenue: -2,
  "Travaux d'intérêt général": -2,
  'Privation d’activités périscolaires/sportives': -2,
  'Engagement parental': -2,
  'Exclusion interne': -4,
  'Exclusion externe': -4,
  'Conseil de discipline': -5,
  'Exclusion définitive': -20,
}

/** Définitions officielles (Section II Partie 2, Généralités) — reprises telles quelles sur les notifications imprimées. */
export const SANCTION_DESCRIPTIONS: Record<SanctionLevel, string> = {
  'Avertissement verbal':
    "Rappel oral immédiat à l'ordre, non consigné par écrit, pour une faute mineure ou un premier manquement — mentionné dans le suivi de l'élève sans notification formelle à la famille.",
  'Avertissement écrit':
    "Rappel formel et écrit à l'ordre, consigné dans le dossier de l'élève, notifiant une faute caractérisée ou une accumulation de manquements mineurs.",
  Blâme:
    "Réprimande formelle inscrite au dossier de l'élève, plus sévère qu'un avertissement écrit, sans engagement contractuel des responsables légaux.",
  Retenue:
    "Obligation pour l'élève de se présenter dans l'établissement en dehors des heures de cours ordinaires (mercredi après-midi ou samedi matin) pour effectuer un travail scolaire ou une tâche d'intérêt général.",
  "Travaux d'intérêt général":
    "Réalisation d'une tâche utile à la vie de l'établissement (rangement, aide aux surveillants, entretien des espaces communs), en dehors des heures de cours, à titre réparateur.",
  'Privation d’activités périscolaires/sportives':
    "Suspension temporaire de participation aux activités sportives, sorties ou clubs de l'établissement, pour une durée déterminée.",
  'Engagement parental':
    "Document contractuel signé conjointement par l'élève, ses responsables légaux et l'administration, fixant des objectifs précis de comportement à respecter sous peine de sanctions plus lourdes.",
  'Exclusion interne':
    "Mesure privative temporaire d'accès aux cours, au sein de l'établissement, pour une durée déterminée, durant laquelle la continuité pédagogique reste obligatoire.",
  'Exclusion externe':
    "Mesure privative temporaire d'accès à l'établissement, pour une durée déterminée, durant laquelle la continuité pédagogique reste obligatoire.",
  'Conseil de discipline':
    "Instance suprême de l'établissement réunissant la direction, l'équipe éducative, les représentants des parents et l'élève, appelée à statuer sur des manquements d'une extrême gravité. Il peut prononcer une exclusion définitive.",
  'Exclusion définitive':
    "Renvoi permanent de l'établissement, prononcé par le Conseil de discipline pour les manquements les plus graves — met fin à la scolarité de l'élève au sein de l'établissement.",
}

export interface DisciplineType {
  code: string
  label: string
  /** Étapes de la procédure telle que définie dans la fiche correspondante du cahier. */
  procedure: string[]
  /** Traduction arabe de `procedure`, même ordre/longueur — affichée uniquement sur le document
   * imprimé remis à la famille (pas dans l'écran de saisie), traduction non officielle à faire
   * valider par la direction avant tout usage réel, comme les autres textes bilingues de l'appli. */
  procedureAr: string[]
  /** Sanctions de référence applicables (les plus légères en premier), à choisir selon la gravité. */
  sanctions: SanctionLevel[]
}

export const DISCIPLINE_TYPES: DisciplineType[] = [
  {
    code: 'PD-01',
    label: 'Bagarre entre élèves',
    procedure: [
      'Intervenir immédiatement et séparer les élèves.',
      'Mettre les élèves dans des espaces distincts sous surveillance.',
      "Vérifier l'état de santé et solliciter des soins si nécessaire.",
      'Recueillir séparément les versions des faits.',
      'Identifier et entendre les témoins.',
      "Rédiger un rapport d'incident détaillé.",
      'Informer le CPE puis la direction.',
      'Informer les familles dans la journée.',
      'Évaluer la gravité et décider de la sanction.',
      'Assurer un suivi après sanction.',
    ],
    procedureAr: [
      'التدخل فورًا وفصل التلاميذ.',
      'وضع التلاميذ في أماكن منفصلة تحت المراقبة.',
      'التحقق من الحالة الصحية وطلب الإسعافات عند الحاجة.',
      'جمع روايات الوقائع من كل طرف على حدة.',
      'تحديد الشهود والاستماع إليهم.',
      'تحرير تقرير مفصل عن الحادثة.',
      'إخبار مسؤول الحياة المدرسية ثم الإدارة.',
      'إخبار الأسر خلال نفس اليوم.',
      'تقييم خطورة الفعل واتخاذ قرار العقوبة.',
      'ضمان متابعة التلميذ بعد تطبيق العقوبة.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Exclusion interne',
      'Exclusion externe',
      'Conseil de discipline',
      'Exclusion définitive',
    ],
  },
  {
    code: 'PD-02',
    label: 'Vol',
    procedure: [
      'Sécuriser la situation et rassurer la victime.',
      'Informer immédiatement le CPE.',
      'Recueillir la déclaration de la victime.',
      'Recueillir les témoignages disponibles.',
      'Effectuer les vérifications autorisées par le règlement.',
      'Rédiger un rapport circonstancié.',
      'Informer les familles concernées.',
      'Décider de la réparation du préjudice et de la sanction.',
      "Assurer le suivi de l'élève.",
    ],
    procedureAr: [
      'تأمين الوضعية وطمأنة الضحية.',
      'إخبار مسؤول الحياة المدرسية فورًا.',
      'تدوين تصريح الضحية.',
      'جمع الشهادات المتوفرة.',
      'إجراء التحققات المسموح بها وفق النظام الداخلي.',
      'تحرير تقرير مفصل عن الوقائع.',
      'إخبار الأسر المعنية.',
      'البت في جبر الضرر وتحديد العقوبة.',
      'ضمان متابعة التلميذ.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Engagement parental',
      'Exclusion interne',
      'Exclusion externe',
      'Conseil de discipline',
      'Exclusion définitive',
    ],
  },
  {
    code: 'PD-03',
    label: 'Utilisation du téléphone',
    procedure: [
      "Demander l'arrêt immédiat de l'utilisation.",
      "Confisquer l'appareil selon le règlement intérieur.",
      "Consigner l'incident dans le registre de vie scolaire (Koolskools).",
      'Informer le CPE en cas de récidive.',
      "Informer les parents à partir de la deuxième infraction.",
      'Appliquer la sanction prévue.',
    ],
    procedureAr: [
      'مطالبة التلميذ بالتوقف الفوري عن الاستعمال.',
      'حجز الجهاز وفق النظام الداخلي.',
      'تسجيل الواقعة في سجل الحياة المدرسية (Koolskools).',
      'إخبار مسؤول الحياة المدرسية في حالة التكرار.',
      'إخبار الأولياء ابتداءً من المخالفة الثانية.',
      'تطبيق العقوبة المقررة.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Engagement parental',
    ],
  },
  {
    code: 'PD-04',
    label: 'Produits illicites ou dangereux',
    procedure: [
      'Sécuriser immédiatement la situation.',
      "Isoler l'élève sous surveillance.",
      'Prévenir le CPE et la direction.',
      "Retirer le produit ou l'objet conformément au règlement.",
      'Rédiger un rapport détaillé.',
      'Informer immédiatement les parents.',
      "Évaluer la nécessité d'un signalement externe.",
      'Décider de la sanction.',
    ],
    procedureAr: [
      'تأمين الوضعية فورًا.',
      'عزل التلميذ تحت المراقبة.',
      'إخبار مسؤول الحياة المدرسية والإدارة.',
      'حجز المادة أو الغرض وفق النظام الداخلي.',
      'تحرير تقرير مفصل.',
      'إخبار الأولياء فورًا.',
      'تقييم مدى الحاجة إلى إشعار جهات خارجية.',
      'اتخاذ قرار العقوبة.',
    ],
    sanctions: ['Exclusion interne', 'Exclusion externe', 'Conseil de discipline', 'Exclusion définitive'],
  },
  {
    code: 'PD-05',
    label: 'Manque de respect envers un enseignant ou adulte',
    procedure: [
      'Faire cesser immédiatement le comportement.',
      "Rappeler la règle et demander à l'élève de se conformer aux consignes.",
      'Exclure temporairement du cours si nécessaire sous surveillance.',
      'Rédiger un rapport.',
      'Informer le CPE.',
      'Recevoir l’élève en entretien.',
      'Informer les parents selon la gravité.',
      'Décider de la sanction.',
    ],
    procedureAr: [
      'وضع حد للسلوك فورًا.',
      'تذكير التلميذ بالقاعدة ومطالبته بالامتثال للتعليمات.',
      'إخراج التلميذ مؤقتًا من الحصة عند الضرورة تحت المراقبة.',
      'تحرير تقرير.',
      'إخبار مسؤول الحياة المدرسية.',
      'استقبال التلميذ لإجراء مقابلة.',
      'إخبار الأولياء حسب درجة الخطورة.',
      'اتخاذ قرار العقوبة.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Exclusion interne',
      'Exclusion externe',
    ],
  },
  {
    code: 'PD-06',
    label: 'Devoirs non faits',
    procedure: [
      'Constater le devoir non réalisé.',
      "Demander les explications de l'élève.",
      "Tracer l'incident dans le suivi pédagogique.",
      'Prévoir un rattrapage.',
      'Informer les parents en cas de répétition.',
      "Mettre en place un accompagnement si nécessaire.",
    ],
    procedureAr: [
      'معاينة عدم إنجاز الواجب.',
      'طلب توضيحات من التلميذ.',
      'تسجيل الواقعة في التتبع التربوي.',
      'برمجة حصة تدارك.',
      'إخبار الأولياء في حالة التكرار.',
      'وضع مواكبة خاصة عند الحاجة.',
    ],
    sanctions: ['Avertissement verbal', 'Avertissement écrit', 'Blâme', 'Engagement parental'],
  },
  {
    code: 'PD-07',
    label: 'Oubli du matériel',
    procedure: [
      "Constater l'oubli.",
      "Permettre à l'élève de suivre le cours autant que possible.",
      "Inscrire l'oubli dans le suivi.",
      'Informer les parents en cas de répétition.',
      'Mettre en place une mesure corrective.',
    ],
    procedureAr: [
      'معاينة النسيان.',
      'تمكين التلميذ من متابعة الحصة قدر الإمكان.',
      'تسجيل الواقعة في التتبع.',
      'إخبار الأولياء في حالة التكرار.',
      'اتخاذ إجراء تصحيحي.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
    ],
  },
  {
    code: 'PD-08',
    label: 'Comportement agressif ou irrespectueux (insultes)',
    procedure: [
      'Intervenir immédiatement de manière ferme pour faire cesser le comportement ou les insultes.',
      "Isoler l'élève auteur des faits afin de faire baisser la tension, sous la surveillance d'un adulte.",
      'Recueillir la version de la victime ainsi que les témoignages des personnes présentes.',
      "Rédiger un rapport d'incident écrit et détaillé qualifiant précisément les propos ou actes commis.",
      "Transmettre le rapport au CPE le jour même et enregistrer l'incident sur Koolskools.",
      "Informer la famille de l'élève par téléphone ou via l'application de la vie scolaire.",
      "Convoquer l'élève à un entretien de recadrage avec le CPE ou la direction.",
      "Exiger la formulation d'excuses officielles (orales ou écrites) envers la personne visée.",
    ],
    procedureAr: [
      'التدخل الفوري والحازم لوضع حد للسلوك أو الشتائم.',
      'عزل التلميذ المتسبب في الواقعة لتهدئة الوضع، تحت مراقبة أحد الراشدين.',
      'جمع رواية الضحية وشهادات الحاضرين.',
      'تحرير تقرير كتابي مفصل يصف بدقة الأقوال أو الأفعال المرتكبة.',
      'إحالة التقرير إلى مسؤول الحياة المدرسية في نفس اليوم وتسجيل الواقعة على Koolskools.',
      'إخبار أسرة التلميذ هاتفيًا أو عبر تطبيق الحياة المدرسية.',
      'استدعاء التلميذ لمقابلة تأطيرية مع مسؤول الحياة المدرسية أو الإدارة.',
      'المطالبة بتقديم اعتذار رسمي (شفهي أو كتابي) للشخص المعني.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Engagement parental',
      'Exclusion interne',
      'Exclusion externe',
    ],
  },
  {
    code: 'PD-09',
    label: "Dégradation du matériel de l'école",
    procedure: [
      'Constater visuellement les dégâts et identifier précisément le ou les auteurs.',
      "Rédiger un rapport d'incident détaillé (nature de la dégradation, lieu, heure et contexte).",
      "Transmettre immédiatement le rapport au CPE et informer le service économique/maintenance pour l'évaluation financière des dommages.",
      "Contacter la famille de l'élève le jour même pour notifier les faits.",
      'Convoquer les parents à un entretien avec la direction pour signer le procès-verbal de dégradation.',
      "Émettre une facture de réparation ou de remplacement prise en charge par la responsabilité civile de la famille.",
    ],
    procedureAr: [
      'معاينة الأضرار بصريًا وتحديد المتسبب أو المتسببين بدقة.',
      'تحرير تقرير مفصل عن الحادثة (طبيعة التخريب، المكان، التوقيت والسياق).',
      'إحالة التقرير فورًا إلى مسؤول الحياة المدرسية وإخبار المصلحة الاقتصادية/الصيانة لتقييم الأضرار ماليًا.',
      'الاتصال بأسرة التلميذ في نفس اليوم لإخبارها بالوقائع.',
      'استدعاء الأولياء لمقابلة مع الإدارة لتوقيع محضر التخريب.',
      'إصدار فاتورة الإصلاح أو التعويض تتحملها المسؤولية المدنية للأسرة.',
    ],
    sanctions: ['Avertissement verbal', 'Avertissement écrit', 'Blâme', 'Engagement parental', 'Exclusion interne', 'Exclusion externe'],
  },
  {
    code: 'PD-10',
    label: "Dégradation du matériel d'un camarade",
    procedure: [
      "Intervenir immédiatement pour figer la situation et éviter que l'incident ne tourne à la bagarre.",
      "Séparer l'auteur et la victime, et conserver l'objet dégradé comme élément de preuve.",
      'Recueillir séparément les déclarations des deux élèves concernés.',
      'Identifier et entendre les témoins éventuels de la scène.',
      "Rédiger un rapport circonstancié et l'enregistrer dans le dossier de vie scolaire sur Koolskools.",
      "Informer les deux familles dans la journée par téléphone ou via l'application.",
      "Organiser une médiation sous la supervision du CPE pour acter le remplacement ou le remboursement de l'objet à l'amiable entre les familles.",
    ],
    procedureAr: [
      'التدخل الفوري لضبط الوضعية وتفادي تحول الحادثة إلى شجار.',
      'فصل المتسبب عن الضحية والاحتفاظ بالغرض المتضرر كدليل.',
      'تدوين تصريحات التلميذين المعنيين كل على حدة.',
      'تحديد الشهود المحتملين والاستماع إليهم.',
      'تحرير تقرير مفصل وتسجيله في ملف الحياة المدرسية على Koolskools.',
      'إخبار الأسرتين خلال نفس اليوم هاتفيًا أو عبر التطبيق.',
      'تنظيم وساطة بإشراف مسؤول الحياة المدرسية لإقرار تعويض أو استبدال الغرض بالتراضي بين الأسرتين.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Engagement parental',
    ],
  },
  {
    code: 'PD-11',
    label: 'Perturbation récurrente des cours (bavardages, coupures de parole, déplacements)',
    procedure: [
      "Adresser un rappel à l'ordre verbal immédiat à l'élève au sein de la classe.",
      "Déplacer l'élève dans la classe ou lui attribuer un travail supplémentaire lié au cours s'il persiste.",
      "En cas de perturbation continue empêchant le cours de se dérouler, exclure temporairement l'élève de la classe, accompagné d'un délégué ou d'un surveillant, avec un travail écrit obligatoire à effectuer.",
      "Enregistrer immédiatement l'incident et l'exclusion de cours sur Koolskools.",
      "Transmettre le rapport d'incident au CPE en fin d'heure.",
      "Recevoir l'élève à la vie scolaire pour un entretien de recadrage avant son retour dans le cours suivant.",
    ],
    procedureAr: [
      'توجيه تنبيه شفهي فوري للتلميذ داخل القسم.',
      'تغيير مكان جلوس التلميذ داخل القسم أو تكليفه بعمل إضافي مرتبط بالحصة إذا استمر السلوك.',
      'في حالة استمرار الإخلال بسير الحصة، إخراج التلميذ مؤقتًا من القسم برفقة مندوب أو حارس عام، مع إلزامه بإنجاز عمل كتابي.',
      'تسجيل الواقعة والإقصاء من الحصة فورًا على Koolskools.',
      'إحالة تقرير الحادثة إلى مسؤول الحياة المدرسية في نهاية الحصة.',
      'استقبال التلميذ بمصلحة الحياة المدرسية لمقابلة تأطيرية قبل عودته إلى الحصة الموالية.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
    ],
  },
  {
    code: 'PD-12',
    label: "Refus d'obéissance ou insubordination",
    procedure: [
      'Maintenir son calme et reformuler la consigne de manière claire, factuelle et non négociable.',
      'Signifier explicitement à l’élève la règle transgressée et les conséquences directes d’un refus persistant.',
      "S'il s'obstine, faire appel à la vie scolaire (surveillant ou CPE) pour faire sortir l'élève afin de ne pas bloquer la classe.",
      "Rédiger un rapport d'incident détaillé qualifiant précisément l'insubordination.",
      'Notification immédiate de l’incident à la famille via Koolskools et par appel téléphonique du CPE.',
      "Organiser un entretien obligatoire réunissant l'élève, le personnel concerné et le CPE pour acter le manquement.",
    ],
    procedureAr: [
      'التحلي بالهدوء وإعادة صياغة التعليمة بشكل واضح وموضوعي وغير قابل للتفاوض.',
      'إبلاغ التلميذ صراحة بالقاعدة المخالفة والعواقب المباشرة لاستمرار الرفض.',
      'في حالة الإصرار، الاستعانة بمصلحة الحياة المدرسية (حارس عام أو مسؤول الحياة المدرسية) لإخراج التلميذ تفاديًا لتعطيل سير القسم.',
      'تحرير تقرير مفصل يصف بدقة واقعة العصيان.',
      'إخبار الأسرة فورًا بالواقعة عبر Koolskools وباتصال هاتفي من مسؤول الحياة المدرسية.',
      'تنظيم مقابلة إلزامية تجمع التلميذ والطاقم المعني ومسؤول الحياة المدرسية لتوثيق المخالفة.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Engagement parental',
      'Exclusion interne',
      'Exclusion externe',
    ],
  },
  {
    code: 'PD-13',
    label: "Tenue vestimentaire ou présentation non réglementaire (uniforme / blouse)",
    procedure: [
      "Contrôler la conformité de la tenue dès l'entrée de l'établissement ou au début de la journée.",
      "Signaler le manquement de manière constructive et demander une régularisation immédiate si possible.",
      'Enregistrer le manquement sur Koolskools.',
      "Si la tenue est jugée totalement inadaptée, isoler l'élève à la vie scolaire et contacter la famille pour un vêtement de rechange.",
      'En cas d’oublis répétés ou de refus de se conformer, convoquer formellement les parents.',
    ],
    procedureAr: [
      'التحقق من مطابقة اللباس منذ دخول المؤسسة أو بداية اليوم الدراسي.',
      'الإشارة إلى المخالفة بأسلوب بنّاء وطلب تسوية الوضع فورًا إن أمكن.',
      'تسجيل المخالفة على Koolskools.',
      'إذا اعتُبر اللباس غير لائق كليًا، عزل التلميذ بمصلحة الحياة المدرسية والاتصال بالأسرة لإحضار لباس بديل.',
      'في حالة التكرار أو رفض الامتثال، استدعاء الأولياء رسميًا.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Exclusion interne',
      'Exclusion externe',
    ],
  },
  {
    code: 'PD-14',
    label: 'Harcèlement, cyberharcèlement ou intimidation entre élèves',
    procedure: [
      "Recueillir le signalement (victime, témoin, enseignant ou parent) avec la plus grande discrétion.",
      "Alerter immédiatement le CPE et la Direction pour geler la situation et protéger la victime.",
      "Entendre séparément et rapidement la victime, l'auteur présumé, ainsi que les témoins éventuels.",
      "Collecter et consigner les preuves matérielles si applicables (captures d'écran, publications, etc.).",
      "Convoquer d'urgence et séparément les parents de l'auteur et ceux de la victime.",
      "Rédiger un dossier disciplinaire complet et mettre en place un protocole de suivi psychologique et de vigilance quotidienne.",
    ],
    procedureAr: [
      'تلقي الإشعار (من الضحية أو الشاهد أو الأستاذ أو الولي) بأقصى قدر من السرية.',
      'إخبار مسؤول الحياة المدرسية والإدارة فورًا لضبط الوضعية وحماية الضحية.',
      'الاستماع بسرعة وعلى حدة إلى الضحية والمشتبه به والشهود المحتملين.',
      'جمع وتوثيق الأدلة المادية إن وجدت (صور الشاشة، المنشورات، إلخ).',
      'استدعاء أولياء المتسبب وأولياء الضحية بشكل مستعجل ومنفصل.',
      'إعداد ملف تأديبي كامل ووضع بروتوكول للمتابعة النفسية واليقظة اليومية.',
    ],
    sanctions: ['Exclusion interne', 'Exclusion externe', 'Engagement parental', 'Conseil de discipline', 'Exclusion définitive'],
  },
  {
    code: 'PD-15',
    label: "Sortie non autorisée de l'établissement (fugue pendant les heures de cours)",
    procedure: [
      "Constater l'absence inexpliquée d'un élève au pointage alors qu'il était présent précédemment.",
      "Lancer immédiatement une vérification physique dans tous les espaces de l'établissement.",
      "Si l'absence hors des murs est confirmée ou fortement suspectée, alerter instantanément la Direction et le CPE.",
      "Contacter immédiatement la famille pour signaler la disparition et vérifier si l'élève est rentré au domicile.",
      "Rédiger un rapport officiel d'incident minute par minute.",
      "Dès le retour de l'élève, organiser un entretien d'extrême fermeté avec la Direction, le CPE et les parents avant toute réintégration.",
    ],
    procedureAr: [
      'معاينة غياب التلميذ دون مبرر أثناء التفقد رغم تسجيل حضوره سابقًا.',
      'الشروع فورًا في تفتيش ميداني لجميع فضاءات المؤسسة.',
      'إذا تأكد أو اشتُبه بقوة في مغادرة التلميذ للمؤسسة، إخبار الإدارة ومسؤول الحياة المدرسية فورًا.',
      'الاتصال فورًا بالأسرة لإخبارها بالاختفاء والتحقق مما إذا كان التلميذ قد عاد إلى المنزل.',
      'تحرير تقرير رسمي مفصل دقيقة بدقيقة.',
      'فور عودة التلميذ، تنظيم مقابلة صارمة مع الإدارة ومسؤول الحياة المدرسية والأولياء قبل أي إعادة إدماج.',
    ],
    sanctions: ['Exclusion interne', 'Exclusion externe', 'Engagement parental', 'Conseil de discipline', 'Exclusion définitive'],
  },
  {
    code: 'PD-16',
    label: 'Introduction d’objets interdits mais non dangereux (jeux, objets de valeur, trottinettes, etc.)',
    procedure: [
      "Constater la possession, l'utilisation ou le déploiement de l'objet interdit.",
      "Interpeller l'élève et procéder à la confiscation immédiate et temporaire de l'objet.",
      "Déposer l'objet confisqué en lieu sûr au bureau de la vie scolaire, étiqueté au nom et à la classe de l'élève.",
      "Enregistrer l'incident et la mesure de confiscation sur Koolskools le jour même.",
      "Informer les parents de la nature de l'objet saisi.",
      "Restituer l'objet confisqué exclusivement aux parents, en fin de journée ou de semaine.",
    ],
    procedureAr: [
      'معاينة حيازة الغرض الممنوع أو استعماله أو استخدامه.',
      'استجواب التلميذ والقيام بحجز الغرض فورًا وبشكل مؤقت.',
      'إيداع الغرض المحجوز في مكان آمن بمكتب الحياة المدرسية، مع وضع بطاقة تحمل اسم التلميذ وقسمه.',
      'تسجيل الواقعة وإجراء الحجز على Koolskools في نفس اليوم.',
      'إخبار الأولياء بطبيعة الغرض المحجوز.',
      'إرجاع الغرض المحجوز حصريًا للأولياء، في نهاية اليوم أو الأسبوع.',
    ],
    sanctions: [
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
    ],
  },
  {
    code: 'PD-17',
    label: 'Non-présentation délibérée à une retenue ou à un travail supplémentaire',
    procedure: [
      "Constater l'absence injustifiée de l'élève à sa retenue, ou la non-remise d'un travail supplémentaire à échéance.",
      "Informer immédiatement le CPE du non-respect de la punition initiale.",
      "Convoquer obligatoirement l'élève au bureau de la vie scolaire dès le lendemain pour obtenir ses explications.",
      "Consigner le refus d'exécuter la sanction (assimilé à un acte d'insubordination) sur Koolskools.",
      "Contacter directement les parents par téléphone pour leur signaler le manquement et la gravité du refus.",
      "Planifier la nouvelle date de la sanction aggravée et notifier officiellement la famille.",
    ],
    procedureAr: [
      'معاينة غياب التلميذ غير المبرر عن الحجز، أو عدم تسليم العمل الإضافي في الأجل المحدد.',
      'إخبار مسؤول الحياة المدرسية فورًا بعدم احترام العقوبة الأولى.',
      'استدعاء التلميذ إلزاميًا إلى مكتب الحياة المدرسية في اليوم الموالي للحصول على توضيحاته.',
      'تسجيل رفض تنفيذ العقوبة (باعتباره فعل عصيان) على Koolskools.',
      'الاتصال المباشر بالأولياء هاتفيًا لإخبارهم بالمخالفة وخطورة الرفض.',
      'تحديد موعد جديد للعقوبة المشددة وإخبار الأسرة رسميًا.',
    ],
    sanctions: [
      'Retenue',
      "Travaux d'intérêt général",
      'Privation d’activités périscolaires/sportives',
      'Engagement parental',
      'Avertissement verbal',
      'Avertissement écrit',
      'Blâme',
      'Exclusion interne',
      'Exclusion externe',
    ],
  },
]

export function findDisciplineType(code: string | undefined): DisciplineType | undefined {
  return DISCIPLINE_TYPES.find((t) => t.code === code)
}

/** Note de conduite recalculée à partir de l'historique complet des points (mérites + sanctions), plafonnée à [0, 20]. */
export function computeConduite(points: number[]): number {
  const total = points.reduce((sum, p) => sum + p, 20)
  return Math.max(0, Math.min(20, total))
}

/** Suivi du processus de convocation (FICHE CADRE 7), pour les sanctions "Conseil de discipline". */
export const CONSEIL_STATUTS = ['a_convoquer', 'convocation_envoyee', 'instance_tenue'] as const
export type ConseilStatut = (typeof CONSEIL_STATUTS)[number]

export const CONSEIL_STATUT_LABELS: Record<ConseilStatut, string> = {
  a_convoquer: 'À convoquer',
  convocation_envoyee: 'Convocation envoyée',
  instance_tenue: 'Instance tenue',
}
