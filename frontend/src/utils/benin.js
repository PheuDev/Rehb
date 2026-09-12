// Découpage administratif du Bénin (départements, communes, arrondissements)

// Données issues du découpage territorial officiel :
// https://github.com/leplutonien/decoupage_territorial_benin

export const DEPARTEMENTS = [
    "Alibori",
    "Atacora",
    "Atlantique",
    "Borgou",
    "Collines",
    "Couffo",
    "Donga",
    "Littoral",
    "Mono",
    "Ouémé",
    "Plateau",
    "Zou"
];

export const COMMUNES_BY_DEPARTEMENT = {
  "Alibori": [
    "Banikoara",
    "Gogounou",
    "Kandi",
    "Karimama",
    "Malanville",
    "Segbana"
  ],
  "Atacora": [
    "Boukoumbé",
    "Cobly",
    "Kérou",
    "Kouandé",
    "Matéri",
    "Natitingou",
    "Péhunco",
    "Tanguiéta",
    "Toucountouna"
  ],
  "Atlantique": [
    "Abomey-Calavi",
    "Allada",
    "Kpomassè",
    "Ouidah",
    "Sô-Ava",
    "Toffo",
    "Tori-Bossito",
    "Zè"
  ],
  "Borgou": [
    "Bembéréké",
    "Kalalé",
    "N'Dali",
    "Nikki",
    "Parakou",
    "Pèrèrè",
    "Sinendé",
    "Tchaourou"
  ],
  "Collines": [
    "Bantè",
    "Dassa-Zoumé",
    "Glazoué",
    "Ouèssè",
    "Savalou",
    "Savè"
  ],
  "Couffo": [
    "Aplahoué",
    "Djakotomey",
    "Dogbo",
    "Klouékanmè",
    "Lalo",
    "Toviklin"
  ],
  "Donga": [
    "Bassila",
    "Copargo",
    "Djougou",
    "Ouaké"
  ],
  "Littoral": [
    "Cotonou"
  ],
  "Mono": [
    "Athiémé",
    "Bopa",
    "Comè",
    "Grand-Popo",
    "Houéyogbé",
    "Lokossa"
  ],
  "Ouémé": [
    "Adjarra",
    "Adjohoun",
    "Aguégués",
    "Akpro-Missérété",
    "Avrankou",
    "Bonou",
    "Dangbo",
    "Porto-Novo",
    "Sèmè-Kpodji"
  ],
  "Plateau": [
    "Adja-Ouèrè",
    "Ifangni",
    "Kétou",
    "Pobè",
    "Sakété"
  ],
  "Zou": [
    "Abomey",
    "Agbangnizoun",
    "Bohicon",
    "Covè",
    "Djidja",
    "Ouinhi",
    "Zagnanado",
    "Za-Kpota",
    "Zogbodomey"
  ],
};

export const ARRONDISSEMENTS_BY_COMMUNE = {
  "Banikoara": [
    "Founougo",
    "Gomparou",
    "Goumori",
    "Kokey",
    "Kokiborou",
    "Ounet",
    "Somperoukou",
    "Soroko",
    "Toura",
    "Banikoara"
  ],
  "Gogounou": [
    "Bagou",
    "Gounarou",
    "Sori",
    "Sougou-Kpan-Trossi",
    "Wara",
    "Gogounou"
  ],
  "Kandi": [
    "Angaradebou",
    "Bensekou",
    "Donwari",
    "Kassakou",
    "Saah",
    "Sam",
    "Sonsoro",
    "Kandi 1",
    "Kandi 2",
    "Kandi 3"
  ],
  "Karimama": [
    "Birni Lafia",
    "Bogo-Bogo",
    "Kompa",
    "Monsey",
    "Karimama"
  ],
  "Malanville": [
    "Garou",
    "Guene",
    "Madecali",
    "Toumboutou",
    "Malanville"
  ],
  "Segbana": [
    "Libante",
    "Liboussou",
    "Lougou",
    "Sokotindji",
    "Segbana"
  ],
  "Boukoumbé": [
    "Dipoli",
    "Korontiere",
    "Koussoucoingou",
    "Manta",
    "Nata",
    "Tabota",
    "Boukoumbe"
  ],
  "Cobly": [
    "Datori",
    "Kountori",
    "Tapoga",
    "Cobly"
  ],
  "Kérou": [
    "Brignamaro",
    "Firou",
    "Kaobagou",
    "Kerou"
  ],
  "Kouandé": [
    "Birni",
    "Chabi-Couma",
    "Foo-Tance",
    "Guilmaro",
    "Oroukayo",
    "Kouande"
  ],
  "Matéri": [
    "Dassari",
    "Gouande",
    "Nodi",
    "Tantega",
    "Tchanhouncossi",
    "Materi"
  ],
  "Natitingou": [
    "Kotopounga",
    "Kouaba",
    "Kouandata",
    "Perma",
    "Tchoumi-Tchoumi",
    "Natitingou I",
    "Natitingou Ii",
    "Natitingou Iii",
    "Peporiyakou"
  ],
  "Péhunco": [
    "Gnemasson",
    "Tobre",
    "Pehunco"
  ],
  "Tanguiéta": [
    "Cotiakou",
    "N'Dahonta",
    "Taiacou",
    "Tanongou",
    "Tanguieta"
  ],
  "Toucountouna": [
    "Kouarfa",
    "Tampegre",
    "Toukountouna"
  ],
  "Abomey-Calavi": [
    "Akassato",
    "Godomey",
    "Golo-Djigbe",
    "Hevie",
    "Kpanroun",
    "Ouedo",
    "Togba",
    "Zinvie",
    "Abomey-Calavi"
  ],
  "Allada": [
    "Agbanou",
    "Ahouannonzoun",
    "Attogon",
    "Avakpa",
    "Ayou",
    "Hinvi",
    "Lissegazoun",
    "Lon-Agonmey",
    "Sekou",
    "Tokpa",
    "Allada Centre",
    "Togoudo"
  ],
  "Kpomassè": [
    "Aganmalome",
    "Agbanto",
    "Agonkanme",
    "Dedome",
    "Dekanme",
    "Segbeya",
    "Segbohoue",
    "Tokpa-Dome",
    "Kpomasse Centre"
  ],
  "Ouidah": [
    "Avlekete",
    "Djegbadji",
    "Gakpe",
    "Houakpe-Daho",
    "Pahou",
    "Savi",
    "Ouidah I",
    "Ouidah Ii",
    "Ouidah Iii",
    "Ouidah Iv"
  ],
  "Sô-Ava": [
    "Ahomey-Lokpo",
    "Dekanmey",
    "Ganvie 1",
    "Ganvie 2",
    "Houedo-Aguekon",
    "Vekky",
    "So-Ava"
  ],
  "Toffo": [
    "Ague",
    "Colli",
    "Coussi",
    "Dame",
    "Djanglanme",
    "Houegbo",
    "Kpome",
    "Sehoue",
    "Sey",
    "Toffo"
  ],
  "Tori-Bossito": [
    "Avame",
    "Azohoue-Aliho",
    "Azohoue-Cada",
    "Tori-Cada",
    "Tori-Gare",
    "Tori-Bossito"
  ],
  "Zè": [
    "Adjan",
    "Dawe",
    "Djigbe",
    "Dodji-Bata",
    "Hekanme",
    "Koundokpoe",
    "Sedje-Denou",
    "Sedje-Houegoudo",
    "Tangbo",
    "Yokpo",
    "Ze"
  ],
  "Bembéréké": [
    "Beroubouay",
    "Bouanri",
    "Gamia",
    "Ina",
    "Bembereke"
  ],
  "Kalalé": [
    "Basso",
    "Bouca",
    "Derassi",
    "Dunkassa",
    "Peonga",
    "Kalale"
  ],
  "N'Dali": [
    "Bori",
    "Gbegourou",
    "Ouenou",
    "Sirarou",
    "N'Dali"
  ],
  "Nikki": [
    "Biro",
    "Gnonkourokali",
    "Ouenou",
    "Serekali",
    "Suya",
    "Tasso",
    "Nikki"
  ],
  "Parakou": [
    "1er Arrondissement",
    "2eme Arrondissement",
    "3eme Arrondissement"
  ],
  "Pèrèrè": [
    "Gninsy",
    "Guinagourou",
    "Kpebie",
    "Pane",
    "Sontou",
    "Perere"
  ],
  "Sinendé": [
    "Fo-Boure",
    "Sekere",
    "Sikki",
    "Sinende"
  ],
  "Tchaourou": [
    "Alafiarou",
    "Beterou",
    "Goro",
    "Kika",
    "Sanson",
    "Tchatchou",
    "Tchaourou"
  ],
  "Bantè": [
    "Agoua",
    "Akpassi",
    "Atokolibe",
    "Bobe",
    "Gouka",
    "Koko",
    "Lougba",
    "Pira",
    "Bante"
  ],
  "Dassa-Zoumé": [
    "Akoffodjoule",
    "Gbaffo",
    "Kere",
    "Kpingni",
    "Lema",
    "Paouingnan",
    "Soclogbo",
    "Tre",
    "Dassa I",
    "Dassa Ii"
  ],
  "Glazoué": [
    "Aklampa",
    "Assante",
    "Gome",
    "Kpakpaza",
    "Magoumi",
    "Ouedeme",
    "Sokponta",
    "Thio",
    "Zaffe",
    "Glazoue"
  ],
  "Ouèssè": [
    "Challa-Ogoi",
    "Djegbe",
    "Gbanlin",
    "Ikemon",
    "Kilibo",
    "Laminou",
    "Odougba",
    "Toui",
    "Ouesse"
  ],
  "Savalou": [
    "Djalloukou",
    "Doume",
    "Gobada",
    "Kpataba",
    "Lahotan",
    "Lema",
    "Logozohe",
    "Monkpa",
    "Ottola",
    "Ouesse",
    "Tchetti",
    "Savalou-Aga",
    "Savalou-Agbado",
    "Savalou-Attake"
  ],
  "Savè": [
    "Besse",
    "Kaboua",
    "Offe",
    "Okpara",
    "Sakin",
    "Adido",
    "Boni",
    "Plateau"
  ],
  "Aplahoué": [
    "Atomey",
    "Azove",
    "Dekpo-Centre",
    "Godohou",
    "Kissamey",
    "Lonkly",
    "Aplahoue"
  ],
  "Djakotomey": [
    "Adjintimey",
    "Betoumey",
    "Gohomey",
    "Houegamey",
    "Kinkinhoue",
    "Kokohoue",
    "Kpoba",
    "Sokouhoue",
    "Djakotomey I",
    "Djakotomey Ii"
  ],
  "Dogbo": [
    "Ayomi",
    "Deve",
    "Honton",
    "Lokogohoue",
    "Madjre",
    "Totchangni Centre",
    "Tota"
  ],
  "Klouékanmè": [
    "Adjahonme",
    "Ahogbeya",
    "Ayahohoue",
    "Djotto",
    "Hondjin",
    "Lanta",
    "Tchikpe",
    "Klouekanme"
  ],
  "Lalo": [
    "Adoukandji",
    "Ahodjinnako",
    "Ahomadegbe",
    "Banigbe",
    "Gnizounme",
    "Hlassame",
    "Lokogba",
    "Tchito",
    "Tohou",
    "Zalli",
    "Lalo"
  ],
  "Toviklin": [
    "Adjido",
    "Avedjin",
    "Doko",
    "Houedogli",
    "Missinko",
    "Tannou-Gola",
    "Toviklin"
  ],
  "Bassila": [
    "Aledjo",
    "Manigri",
    "Penessoulou",
    "Bassila"
  ],
  "Copargo": [
    "Anandana",
    "Pabegou",
    "Singre",
    "Copargo"
  ],
  "Djougou": [
    "Barei",
    "Barienou",
    "Bellefoungou",
    "Bougou",
    "Koloconde",
    "Onklou",
    "Partago",
    "Pelebina",
    "Serou",
    "Djougou I",
    "Djougou Ii",
    "Djougou Iii"
  ],
  "Ouaké": [
    "Badjoude",
    "Komde",
    "Semere 1",
    "Semere 2",
    "Tchalinga",
    "Ouake"
  ],
  "Cotonou": [
    "1er Arrondissement",
    "2eme Arrondissement",
    "3eme Arrondissement",
    "4eme Arrondissement",
    "5eme Arrondissement",
    "6eme Arrondissement",
    "7eme Arrondissement",
    "8eme Arrondissement",
    "9eme Arrondissement",
    "10eme Arrondissement",
    "11eme Arrondissement",
    "12eme Arrondissement",
    "13eme Arrondissement"
  ],
  "Athiémé": [
    "Adohoun",
    "Atchannou",
    "Dedekpoe",
    "Kpinnou",
    "Athieme"
  ],
  "Bopa": [
    "Agbodji",
    "Badazouin",
    "Gbakpodji",
    "Lobogo",
    "Possotome",
    "Yegodoe",
    "Bopa"
  ],
  "Comè": [
    "Agatogbo",
    "Akodeha",
    "Ouedeme-Pedah",
    "Oumako",
    "Come"
  ],
  "Grand-Popo": [
    "Adjaha",
    "Agoue",
    "Avlo",
    "Djanglanmey",
    "Gbehoue",
    "Sazue",
    "Grand-Popo"
  ],
  "Houéyogbé": [
    "Dahe",
    "Doutou",
    "Honhoue",
    "Zoungbonou",
    "Houeyogbe",
    "Se"
  ],
  "Lokossa": [
    "Agame",
    "Houin",
    "Koudo",
    "Ouedeme-Adja",
    "Lokossa"
  ],
  "Adjarra": [
    "Aglogbe",
    "Honvie",
    "Malanhoui",
    "Mededjonou",
    "Adjarra 1",
    "Adjarra 2"
  ],
  "Adjohoun": [
    "Akpadanou",
    "Awonou",
    "Azowlisse",
    "Deme",
    "Gangban",
    "Kode",
    "Togbota",
    "Adjohoun"
  ],
  "Aguégués": [
    "Avagbodji",
    "Houedome",
    "Zoungame"
  ],
  "Akpro-Missérété": [
    "Gome-Sota",
    "Katagon",
    "Vakon",
    "Zoungbome",
    "Akpro-Misserete"
  ],
  "Avrankou": [
    "Atchoukpa",
    "Djomon",
    "Gbozoume",
    "Kouti",
    "Ouanho",
    "Sado",
    "Avrankou"
  ],
  "Bonou": [
    "Affame",
    "Atchonsa",
    "Dame-Wogon",
    "Hounvigue",
    "Bonou"
  ],
  "Dangbo": [
    "Dekin",
    "Gbeko",
    "Houedomey",
    "Hozin",
    "Kessounou",
    "Zoungue",
    "Dangbo"
  ],
  "Porto-Novo": [
    "1er Arrondissement",
    "2eme Arrondissement",
    "3eme Arrondissement",
    "4eme Arrondissement",
    "5eme Arrondissement"
  ],
  "Sèmè-Kpodji": [
    "Agblangandan",
    "Aholouyeme",
    "Djeregbe",
    "Ekpe",
    "Tohoue",
    "Seme-Podji"
  ],
  "Adja-Ouèrè": [
    "Ikpinle",
    "Kpoulou",
    "Masse",
    "Oko-Akare",
    "Tatonnonkon",
    "Adja-Ouere"
  ],
  "Ifangni": [
    "Banigbe",
    "Daagbe",
    "Ko-Koumolou",
    "Lagbe",
    "Tchaada",
    "Ifangni"
  ],
  "Kétou": [
    "Adakplame",
    "Idigny",
    "Kpankou",
    "Odometa",
    "Okpometa",
    "Ketou"
  ],
  "Pobè": [
    "Ahoyeye",
    "Igana",
    "Issaba",
    "Towe",
    "Pobe"
  ],
  "Sakété": [
    "Aguidi",
    "Ita-Djebou",
    "Takon",
    "Yoko",
    "Sakete 1",
    "Sakete 2"
  ],
  "Abomey": [
    "Agbokpa",
    "Detohou",
    "Sehoun",
    "Zounzonme",
    "Djegbe",
    "Hounli",
    "Vidole"
  ],
  "Agbangnizoun": [
    "Adanhondjigo",
    "Adingnigon",
    "Kinta",
    "Kpota",
    "Lissazounme",
    "Sahe",
    "Sinwe",
    "Tanve",
    "Zoungoundo",
    "Agbangnizoun"
  ],
  "Bohicon": [
    "Agongointo",
    "Avogbanna",
    "Gnidjazoun",
    "Lissezoun",
    "Ouassaho",
    "Passagon",
    "Saclo",
    "Sodohome",
    "Bohicon I",
    "Bohicon Ii"
  ],
  "Covè": [
    "Houeko",
    "Adogbe",
    "Gounli",
    "Houin-Hounso",
    "Lainta-Cogbe",
    "Naogon",
    "Soli",
    "Zogba"
  ],
  "Djidja": [
    "Agondji",
    "Agouna",
    "Dan",
    "Dohouime",
    "Gobaix",
    "Houto",
    "Monsourou",
    "Mougnon",
    "Oumbegame",
    "Setto",
    "Zounkon",
    "Djidja Centre"
  ],
  "Ouinhi": [
    "Dasso",
    "Sagon",
    "Tohoues",
    "Ouinhi Centre"
  ],
  "Zagnanado": [
    "Agonlin-Houegbo",
    "Baname",
    "Don-Tan",
    "Dovi",
    "Kpedekpo",
    "Zagnanado Centre"
  ],
  "Za-Kpota": [
    "Allahe",
    "Assanlin",
    "Houngome",
    "Kpakpame",
    "Kpozoun",
    "Za-Tanta",
    "Zeko",
    "Za-Kpota"
  ],
  "Zogbodomey": [
    "Akiza",
    "Avlame",
    "Cana I",
    "Cana Ii",
    "Dome",
    "Koussoukpa",
    "Kpokissa",
    "Massi",
    "Tanwe-Hessou",
    "Zoukou",
    "Zogbodomey Centre"
  ],
};
