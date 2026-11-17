'use strict';

const GREEK = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega'.split(' ');

const NATO = 'Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu'.split(' ');

// The one-word names from Wikipedia's "List of proper names of stars", November 2026.
const STARS = [
  'Absolutno Acamar Achernar Achird Acrab Acrux Acubens Adhafera Adhara Adhil Aerostaticus Ain',
  'Ainalrami Aiolos Aladfar Alasia Alawaidh Alaybasan Albaldah Albali Albireo Alchiba Alcor Alcyone',
  'Aldebaran Alderamin Aldhanab Aldhibah Aldulfin Alfarasalkamil Alfirk Algedi Algenib Algieba Algol',
  'Algorab Alhena Alioth Aljanah Alkaid Alkalurops Alkaphrah Alkarab Alkes Almaaz Almach Almighzal',
  'Alnaamaat Alnair Alnasl Alnilam Alnitak Alniyat Alphard Alphecca Alpheratz Alpherg Alqiladah',
  'Alqubba Alrakis Alrescha Alruba Alrumh Alsafi Alsamaka Alsciaukat Alsephina Alshain Alshat Altair',
  'Altais Alterf Aludra Alwasl Alya Alzirr Amadioha Amansinaya Anadolu Ancha Angetenar Aniara Ankaa',
  'Anser Antares Antinous Anunitu Apamvatsa Apdu Arcturus Arneb Ascella Ashlesha Aspidiske Asterope',
  'Asuusiha Atakoraka Athebyne Atik Atlas Atria Aurwandilsta Avior Ayeyarwady Azelfafage Azha Azmidi',
  'Bade Baekdu Bagu Baijiu Baltesha Bawy Beemim Beid Belel Bellatrix Berehynia Betelgeuse Bharani',
  'Bibing Bie Biham Bodu Bosona Botein Brachium Bubup Buna Bunda Buranun Calvera Canopus Capella Caph',
  'Castor Castula Cebalrai Ceibo Celaeno Cervantes Cexing Chalawan Chamukuy Chaophraya Chara Chechia',
  'Chertan Chugao Citadelle Cocibolca Copernicus Cujam Cursa Custos Dabih Dajiangjunbei Dalim Danfeng',
  'Darlugal Deltoton Deneb Denebola Dhanishta Diadem Dilmun Dingolay Diphda Diya Dofida Dombay',
  'Dschubba Dubhe Dziban Ebla Edasich Electra Elgafar Elkurud Elnath Eltanin Emiw Enif Errai Fafnir',
  'Fang Fawaris Felis Felixvarela Fenmu Filetdor Flegetonte Fomalhaut Formosa Franz Fulu Fumalsamakah',
  'Funi Furud Fuyue Gacrux Gaja Gajahmina Gakyid Gang Gar Geminga Genghe Giausar Gienah Ginan Gloas',
  'Gnomon Gomeisa Gouguo Grumium Guahayona Guansuo Gudja Gumala Guniibuu Guqi Hadar Haedus Hamal',
  'Hassaleh Hatysa Helvetios Heng Heryibwia Heze Hoerikwaggo Hoggar Holoea Homam Honores Horna Hru',
  'Huagai Hunor Hydor Idigna Iklil Illyrian Imai Inquill Intan Intercrus Irena Itonda Izar Jabbah Jian',
  'Jiantai Jishui Jiu Jordanus Junnanmen Kaewkosin Kaffaljidhma Kaffalmusalsala Kalasungsang Kalausi',
  'Kamelos Kamuy Kang Karaka Kautoki Kaveh Keid Kenemu Khambalia Khepdenreret Kitalpha Kochab Koeia',
  'Koit Komondor Kornephoros Kosjenka Kraz Krios Kronos Kuda Kui Kulou Kurhah Larawag Leepwal Leidian',
  'Lembu Lerna Lesath Libertas Lich Liesma Ligong Lintangkumba Lionrock Lucilinburhuc Lumbung Maasym',
  'Macondo Maenalus Mago Magur Mahasim Mahsati Maia Malmok Marfik Markab Markeb Marsic Maru Matar',
  'Matrichakra Matza Mazaalai Mebsuta Megrez Meissa Mekbuda Meleph Menkalinan Menkar Menkent Menkib',
  'Merak Merga Meridiana Merope Mesarthim Miaplacidus Mimosa Minchir Minelauva Mintaka Mira Mirach',
  'Miram Mirfak Mirzam Misam Mizar Moldoveanu Montuno Morava Moriah Moth Mothallah Mouhoun Mpingo',
  'Muliphein Muning Muphrid Muscida Musica Muspelheim Naga Nahn Naledi Nandou Naos Nashira Natasha',
  'Necklace Neichu Nekkar Nembus Nenque Nervia Nganurganity Niandao Nihal Nikawiy Ninnisig Noquisi',
  'Nosaxa Nunki Nusakan Nushagak Nyamien Ogma Okab Orkaria Pabilsang Pagru Paikauhale Paloma Paradys',
  'Parumleo Paushna Peacock Petra Phact Phecda Pherkad Phoenicia Piautos Pili Pincoya Ping Pipirima',
  'Pipit Pipoltr Pleione Poerava Polaris Polis Pollux Pongaponga Porrima Praecipua Procyon Propus',
  'Protome Pulcherrima Qedty Qigong Quadrans Ramus Ran Rana Rangifer Rapeto Rasalas Rasalgethi',
  'Rasalhague Rasalnaqa Rastaban Regulus Revati Rhombus Rigel Rotanev Ruchbah Rukbat Sabik Saclateni',
  'Sadachbia Sadalbari Sadalmelik Sadalsuud Sadr Safina Sagarmatha Saiph Salm Sansuna Sapaki Sargas',
  'Sarin Sarvvis Sceptrum Scheat Schedar Segin Seginus Shakata Shakh Sham Shama Shangcheng Shangwei',
  'Shaomin Shaowei Sharjah Shatabhisha Shaula Sheliak Shengong Sheratan Shimu Sika Simmakh Sirius',
  'Situla Siwarha Skat Solaris Solitaire Spica Stellio Stephanos Sterrennacht Stribor Sualocin Subra',
  'Suhail Sukhurmashu Sulafat Syrma Tabit Taika Taiyangshou Taiyi Talitha Tangra Tapecue Tarandus',
  'Tarazed Tarf Taygeta Tegmine Tejat Telum Tengshe Tepennekhet Tepiamenit Terebellum Tevel Theemin',
  'Thuban Tiaki Tianbang Tianbian Tiancang Tianfu Tiangang Tianguan Tianhun Tianji Tianjinnan Tianjiu',
  'Tiansi Tianyi Tianyue Timir Tislit Titawin Tojil Toliman Tonatiuh Tonglingxing Torcular Triminus',
  'Tugongli Tuiren Tupi Tureis Tusizuo Udang Udkadua Ukdah Uklun Unukalhai Uridim Urquchillay Uruk',
  'Vega Veritate Vindemiatrix Waiping Wasat Wattle Wazn Weixiu Wezen Wouri Wurren Xami Xamidimura Xihe',
  'Xuange Yaqana Yildun Yunyu Yuyu Zaniah Zaurak Zavijava Zembra Zhang Zhou Zibal Zibbatu Zosma',
  'Zubenelgenubi Zubenelhakrabi Zubeneschamali Zuogeng Zuoqi',
].join(' ').split(' ');

// About the top 50 boys' and 50 girls' names given to US babies (Social Security, 2023).
const PEOPLE = [
  'Liam Noah Oliver James Elijah Mateo Theodore Henry Lucas William Benjamin Levi Sebastian Jack Ezra',
  'Michael Daniel Leo Owen Samuel Hudson Alexander Asher Luca Ethan John David Jackson Joseph Mason Luke',
  'Matthew Julian Dylan Elias Jacob Maverick Gabriel Logan Aiden Thomas Isaac Miles Grayson Santiago',
  'Anthony Wyatt Carter Jayden Ezekiel',
  'Olivia Emma Charlotte Amelia Sophia Mia Isabella Ava Evelyn Luna Harper Sofia Camila Eleanor Elizabeth',
  'Violet Scarlett Emily Hazel Lily Gianna Aurora Penelope Aria Nora Chloe Ellie Mila Avery Layla Abigail',
  'Ella Isla Eliana Nova Madison Zoe Ivy Grace Lucy Willow Emilia Riley Naomi Victoria Stella Elena',
  'Hannah Valentina Maya',
].join(' ').split(' ');

const LISTS = { greek: GREEK, nato: NATO, stars: STARS, people: PEOPLE };
const LIST_KEYS = [...Object.keys(LISTS), 'custom'];

// The names new leads draw from: the chosen built-in list, or the uploaded custom one.
// A custom choice with no names falls back to Greek letters.
function namesFor(settings) {
  if (settings.lead_name_list === 'custom') return settings.lead_names?.length ? settings.lead_names : GREEK;
  return LISTS[settings.lead_name_list] || GREEK;
}

// Picks a random free name. Plain names come first; only once every one is held
// does it move on to "<name> 2", then "<name> 3", and so on.
function chooseName(threads, names = [], random = Math.random) {
  const list = names.length ? names : GREEK;
  const held = new Set(threads.filter((thread) => !thread.archived && thread.lead_name).map((thread) => thread.lead_name.toLowerCase()));
  for (let n = 1; ; n++) {
    const free = list.map((name) => (n === 1 ? name : `${name} ${n}`)).filter((candidate) => !held.has(candidate.toLowerCase()));
    if (free.length) return free[Math.floor(random() * free.length)];
  }
}

module.exports = { chooseName, namesFor, GREEK, NATO, STARS, PEOPLE, LISTS, LIST_KEYS };
