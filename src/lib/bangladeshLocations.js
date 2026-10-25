const CHARGE = {
  dhakaCity: 70,
  greaterDhaka: 100,
  chattogramCity: 80,
  district: 130,
  remote: 160,
};

function areas(list, charge) {
  return list.map((item) =>
    typeof item === "string"
      ? { name: item, charge }
      : { name: item[0], charge: item[1] ?? charge },
  );
}

function zones(district, upazilas, charge) {
  return upazilas.map((entry) => {
    if (typeof entry === "string") {
      return {
        name: `${district} - ${entry}`,
        areas: areas([entry], charge),
      };
    }
    const [upazila, list] = entry;
    return {
      name: `${district} - ${upazila}`,
      areas: areas(list, charge),
    };
  });
}

export const BANGLADESH_LOCATIONS = [
  {
    name: "Dhaka",
    districts: [
      ...zones(
        "Dhaka",
        [
          ["Adabor", ["Adabor", "Mohammadpur Town Hall", "Shyamoli"]],
          ["Badda", ["Badda", "Middle Badda", "North Badda", "Aftabnagar"]],
          ["Banani", ["Banani", "Banani DOHS", "Kamal Ataturk Avenue"]],
          ["Bangshal", ["Bangshal", "Chawkbazar", "Nawabpur"]],
          ["Cantonment", ["Dhaka Cantonment", "Dhaka DOHS", "Banani Cantonment"]],
          ["Chakbazar", ["Chakbazar", "Bakshi Bazar"]],
          ["Dakshinkhan", ["Dakshinkhan", "Uttar Khan"]],
          ["Darus Salam", ["Darus Salam", "Gabtoli", "Technical"]],
          ["Demra", ["Demra", "Staff Quarter", "Matuail"]],
          ["Dhanmondi", ["Dhanmondi", "Dhanmondi 27", "Kalabagan", "Science Lab"]],
          ["Gendaria", ["Gendaria", "Wari", "Jugannath University"]],
          ["Gulshan", ["Gulshan 1", "Gulshan 2", "Gulshan Avenue", "Notun Bazar"]],
          ["Hazaribagh", ["Hazaribagh", "Nawabganj"]],
          ["Jatrabari", ["Jatrabari", "Sayedabad", "Dania"]],
          ["Kadamtali", ["Kadamtali", "Shyampur"]],
          ["Kafrul", ["Kafrul", "Agargaon", "Shewrapara"]],
          ["Kalabagan", ["Kalabagan", "Green Road"]],
          ["Kamrangirchar", ["Kamrangirchar"]],
          ["Khilgaon", ["Khilgaon", "Malibagh", "Taltola"]],
          ["Khilkhet", ["Khilkhet", "Nikunja", "Airport"]],
          ["Kotwali", ["Kotwali", "Sadarghat", "Islampur"]],
          ["Lalbagh", ["Lalbagh", "Azimpur", "Dhakeshwari"]],
          ["Mirpur", ["Mirpur 1", "Mirpur 2", "Mirpur 6", "Mirpur 10", "Mirpur 11", "Mirpur 12", "Sony Cinema"]],
          ["Mohammadpur", ["Mohammadpur", "Bosila", "Japan Garden City", "Krishi Market"]],
          ["Motijheel", ["Motijheel", "Arambagh", "Fakirapool", "Paltan"]],
          ["New Market", ["New Market", "Aziz Super Market", "Elephant Road"]],
          ["Pallabi", ["Pallabi", "Rupnagar", "Mirpur 12 Pallabi"]],
          ["Paltan", ["Paltan", "Bijoynagar", "Press Club"]],
          ["Ramna", ["Ramna", "Shantinagar", "Eskaton", "Kakrail"]],
          ["Rampura", ["Rampura", "Banasree", "Merul Badda"]],
          ["Sabujbagh", ["Sabujbagh", "Mughdapara", "Bashabo"]],
          ["Shah Ali", ["Shah Ali", "Mirpur 1 Bazar"]],
          ["Shahbagh", ["Shahbagh", "TSC", "Bangladesh Medical University"]],
          ["Sher-e-Bangla Nagar", ["Sher-e-Bangla Nagar", "Agargaon Secretariat", "Farmgate"]],
          ["Shyampur", ["Shyampur", "Postogola"]],
          ["Sutrapur", ["Sutrapur", "Gandaria"]],
          ["Tejgaon", ["Tejgaon", "Tejgaon Industrial", "Kawran Bazar", "Farmgate"]],
          ["Turag", ["Turag", "Beribadh"]],
          ["Uttara", ["Uttara Sector 1", "Uttara Sector 3", "Uttara Sector 4", "Uttara Sector 6", "Uttara Sector 7", "Uttara Sector 9", "Uttara Sector 10", "Uttara Sector 11", "Uttara Sector 12", "Uttara Sector 13", "Uttara Sector 14", "Diabari"]],
          ["Wari", ["Wari", "Narinda"]],
        ],
        CHARGE.dhakaCity,
      ),
      ...zones(
        "Dhaka",
        [
          ["Keraniganj", ["Keraniganj Sadar", "Ati", "Zinzira", "Kalatia"]],
          ["Savar", ["Savar Sadar", "Ashulia", "Baipail", "Hemayetpur", "Nabinagar", "Savar EPZ", "Radio Colony"]],
        ],
        CHARGE.greaterDhaka,
      ),
      ...zones(
        "Dhaka",
        [
          ["Dhamrai", ["Dhamrai Sadar", "Kalampur"]],
          ["Dohar", ["Dohar Sadar"]],
          ["Nawabganj", ["Nawabganj Sadar"]],
        ],
        CHARGE.district,
      ),
      ...zones(
        "Gazipur",
        [
          ["Gazipur Sadar", ["Gazipur Sadar", "Joydebpur", "Board Bazar", "Chowrasta"]],
          ["Tongi", ["Tongi", "Cherag Ali", "Station Road", "Gazipura"]],
          ["Kaliakair", ["Kaliakair", "Chandra", "Mouchak"]],
          ["Kaliganj", ["Kaliganj"]],
          ["Kapasia", ["Kapasia"]],
          ["Sreepur", ["Sreepur", "Barmi"]],
        ],
        CHARGE.greaterDhaka,
      ),
      ...zones(
        "Narayanganj",
        [
          ["Narayanganj Sadar", ["Narayanganj Sadar", "Nitaiganj", "Bondhobar"]],
          ["Fatullah", ["Fatullah", "Siddhirganj"]],
          ["Bandar", ["Bandar", "Kadamrasul"]],
          ["Araihazar", ["Araihazar"]],
          ["Rupganj", ["Rupganj", "Bhulta", "Kanchan"]],
          ["Sonargaon", ["Sonargaon", "Mograpara", "Panam"]],
        ],
        CHARGE.greaterDhaka,
      ),
      ...zones("Narsingdi", ["Narsingdi Sadar", "Belabo", "Monohardi", "Palash", "Raipura", "Shibpur"], CHARGE.greaterDhaka),
      ...zones("Faridpur", ["Faridpur Sadar", "Alfadanga", "Bhanga", "Boalmari", "Char Bhadrasan", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"], CHARGE.district),
      ...zones("Gopalganj", ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"], CHARGE.district),
      ...zones("Kishoreganj", ["Kishoreganj Sadar", "Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kuliarchar", "Mithamain", "Nikli", "Pakundia", "Tarail"], CHARGE.district),
      ...zones("Madaripur", ["Madaripur Sadar", "Dasar", "Kalkini", "Rajoir", "Shibchar"], CHARGE.district),
      ...zones("Manikganj", ["Manikganj Sadar", "Daulatpur", "Ghior", "Harirampur", "Saturia", "Shibalaya", "Singair"], CHARGE.district),
      ...zones("Munshiganj", ["Munshiganj Sadar", "Gazaria", "Lohajang", "Sirajdikhan", "Sreenagar", "Tongibari"], CHARGE.greaterDhaka),
      ...zones("Rajbari", ["Rajbari Sadar", "Baliakandi", "Goalanda", "Kalukhali", "Pangsha"], CHARGE.district),
      ...zones("Shariatpur", ["Shariatpur Sadar", "Bhedarganj", "Damudya", "Gosairhat", "Naria", "Zanjira"], CHARGE.district),
      ...zones("Tangail", ["Tangail Sadar", "Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur"], CHARGE.district),
    ],
  },
  {
    name: "Chattogram",
    districts: [
      ...zones(
        "Chattogram",
        [
          ["Agrabad", ["Agrabad", "Agrabad CDA", "Tigerpass", "GEC Circle"]],
          ["Anderkilla", ["Anderkilla", "Chawkbazar", "Reazuddin Bazar"]],
          ["Bakalia", ["Bakalia", "Chandgaon"]],
          ["Bandar", ["Chattogram Bandar", "Sadarghat", "Strand Road"]],
          ["Bayazid", ["Bayazid Bostami", "Oxygen", "Bayazid"]],
          ["Chandgaon", ["Chandgaon", "Sholoshahar", "Kaptai Rastar Matha"]],
          ["Chawkbazar", ["Chawkbazar", "Jamalkhan"]],
          ["Double Mooring", ["Double Mooring", "Agrabad Access", "Lalkhan Bazar"]],
          ["EPZ", ["Chittagong EPZ", "South Halishahar"]],
          ["Halishahar", ["Halishahar", "Navy Colony", "Raufabad"]],
          ["Khulshi", ["Khulshi", "Nasirabad", "WASA"]],
          ["Kotwali", ["Kotwali", "Nandankanan", "Laldighi"]],
          ["Pahartali", ["Pahartali", "Foy's Lake", "College Gate"]],
          ["Panchlaish", ["Panchlaish", "O.R. Nizam Road", "Chittagong Medical"]],
          ["Patenga", ["Patenga", "Airport", "Shah Amanat"]],
        ],
        CHARGE.chattogramCity,
      ),
      ...zones(
        "Chattogram",
        [
          ["Anwara", ["Anwara Sadar", "Bairag"]],
          ["Banshkhali", ["Banshkhali Sadar", "Banigram"]],
          ["Boalkhali", ["Boalkhali Sadar", "Juldha"]],
          ["Chandanaish", ["Chandanaish Sadar"]],
          [
            "Hathazari",
            [
              "Hathazari Sadar",
              "Hathazari Chitt.University",
              "Nazirhat",
              "Katirhat",
              "Gorduara",
              "Madarsha",
            ],
          ],
          ["Fatikchhari", ["Fatikchhari Sadar", "Bibirhat", "Dhurung"]],
          ["Lohagara", ["Lohagara Sadar"]],
          ["Mirsharai", ["Mirsharai Sadar", "Baroiarhat", "Zuhur Nagar"]],
          ["Patiya", ["Patiya Sadar", "Dhalghat"]],
          ["Rangunia", ["Rangunia Sadar", "Padua"]],
          ["Raozan", ["Raozan Sadar", "Gahira", "Noapara"]],
          ["Satkania", ["Satkania Sadar", "Keranihat"]],
          ["Sitakunda", ["Sitakunda Sadar", "Barabkunda", "Kumira", "Bhatiary"]],
        ],
        CHARGE.district,
      ),
      ...zones(
        "Chattogram",
        [["Sandwip", ["Sandwip Sadar", "Urirchar"]]],
        CHARGE.remote,
      ),
      ...zones("Cox's Bazar", [
        ["Cox's Bazar Sadar", ["Cox's Bazar Sadar", "Laboni Beach", "Kolatoli", "Sugandha"]],
        ["Chakaria", ["Chakaria Sadar", "Malumghat"]],
        ["Ramu", ["Ramu"]],
        ["Ukhia", ["Ukhia", "Kutupalong"]],
        ["Teknaf", ["Teknaf", "Saint Martin Ghat"]],
        ["Maheshkhali", ["Maheshkhali"]],
        ["Kutubdia", ["Kutubdia"]],
        ["Pekua", ["Pekua"]],
      ], CHARGE.district),
      ...zones("Cumilla", ["Cumilla Sadar", "Cumilla Sadar Dakshin", "Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Daudkandi", "Debidwar", "Homna", "Laksam", "Lalmai", "Meghna", "Monohorgonj", "Muradnagar", "Nangalkot", "Titas"], CHARGE.district),
      ...zones("Feni", ["Feni Sadar", "Chhagalnaiya", "Daganbhuiyan", "Fulgazi", "Parshuram", "Sonagazi"], CHARGE.district),
      ...zones("Noakhali", ["Noakhali Sadar", "Begumganj", "Chatkhil", "Companiganj", "Kabirhat", "Senbagh", "Sonaimuri", "Subarnachar", ["Hatiya", ["Hatiya Sadar"]]], CHARGE.district),
      ...zones("Lakshmipur", ["Lakshmipur Sadar", "Kamalnagar", "Raipur", "Ramganj", "Ramgati"], CHARGE.district),
      ...zones("Chandpur", ["Chandpur Sadar", "Faridganj", "Haimchar", "Hajiganj", "Kachua", "Matlab Dakshin", "Matlab Uttar", "Shahrasti"], CHARGE.district),
      ...zones("Brahmanbaria", ["Brahmanbaria Sadar", "Akhaura", "Ashuganj", "Bancharampur", "Bijoynagar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail"], CHARGE.district),
      ...zones("Bandarban", ["Bandarban Sadar", "Alikadam", "Lama", "Naikhongchhari", "Rowangchhari", "Ruma", "Thanchi"], CHARGE.remote),
      ...zones("Khagrachhari", ["Khagrachhari Sadar", "Dighinala", "Guimara", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"], CHARGE.remote),
      ...zones("Rangamati", ["Rangamati Sadar", "Bagaichhari", "Barkal", "Belaichhari", "Juraichhari", "Kaptai", "Kawkhali", "Langadu", "Naniarchar", "Rajasthali"], CHARGE.remote),
    ],
  },
  {
    name: "Rajshahi",
    districts: [
      ...zones("Rajshahi", [
        ["Boalia", ["Boalia", "Shaheb Bazar", "New Market"]],
        ["Rajpara", ["Rajpara", "Court Station"]],
        ["Motihar", ["Motihar", "Rajshahi University"]],
        ["Shah Makhdum", ["Shah Makhdum", "Railgate"]],
        "Paba",
        "Puthia",
        "Charghat",
        "Durgapur",
        "Mohanpur",
        "Bagha",
        "Bagmara",
        "Godagari",
        "Tanore",
      ], CHARGE.district),
      ...zones("Bogura", ["Bogura Sadar", "Adamdighi", "Dhunat", "Dhupchanchia", "Gabtali", "Kahaloo", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur", "Shibganj", "Sonatola"], CHARGE.district),
      ...zones("Pabna", ["Pabna Sadar", "Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Santhia", "Sujanagar"], CHARGE.district),
      ...zones("Sirajganj", ["Sirajganj Sadar", "Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Royganj", "Shahjadpur", "Tarash", "Ullahpara"], CHARGE.district),
      ...zones("Natore", ["Natore Sadar", "Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Naldanga", "Singra"], CHARGE.district),
      ...zones("Naogaon", ["Naogaon Sadar", "Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mohadevpur", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"], CHARGE.district),
      ...zones("Chapainawabganj", ["Chapainawabganj Sadar", "Bholahat", "Gomastapur", "Nachole", "Shibganj"], CHARGE.district),
      ...zones("Joypurhat", ["Joypurhat Sadar", "Akkelpur", "Kalai", "Khetlal", "Panchbibi"], CHARGE.district),
    ],
  },
  {
    name: "Khulna",
    districts: [
      ...zones("Khulna", [
        ["Khulna Sadar", ["Khulna Sadar", "Khalishpur", "Sonadanga", "Daulatpur"]],
        "Khalishpur",
        "Sonadanga",
        "Daulatpur",
        "Khan Jahan Ali",
        "Batiaghata",
        "Dacope",
        "Dumuria",
        "Dighalia",
        "Koyra",
        "Paikgachha",
        "Phultala",
        "Rupsha",
        "Terokhada",
      ], CHARGE.district),
      ...zones("Jashore", ["Jashore Sadar", "Abhaynagar", "Bagherpara", "Chaugachha", "Jhikargachha", "Keshabpur", "Manirampur", "Sharsha"], CHARGE.district),
      ...zones("Kushtia", ["Kushtia Sadar", "Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Mirpur"], CHARGE.district),
      ...zones("Jhenaidah", ["Jhenaidah Sadar", "Harinakunda", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"], CHARGE.district),
      ...zones("Chuadanga", ["Chuadanga Sadar", "Alamdanga", "Damurhuda", "Jibannagar"], CHARGE.district),
      ...zones("Magura", ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"], CHARGE.district),
      ...zones("Meherpur", ["Meherpur Sadar", "Gangni", "Mujibnagar"], CHARGE.district),
      ...zones("Narail", ["Narail Sadar", "Kalia", "Lohagara"], CHARGE.district),
      ...zones("Bagerhat", ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"], CHARGE.district),
      ...zones("Satkhira", ["Satkhira Sadar", "Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Shyamnagar", "Tala"], CHARGE.district),
    ],
  },
  {
    name: "Barishal",
    districts: [
      ...zones("Barishal", ["Barishal Sadar", "Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Gaurnadi", "Hizla", "Mehendiganj", "Muladi", "Wazirpur"], CHARGE.district),
      ...zones("Patuakhali", ["Patuakhali Sadar", "Bauphal", "Dashmina", "Dumki", "Galachipa", "Kalapara", "Mirzaganj", ["Rangabali", ["Rangabali"]]], CHARGE.district),
      ...zones("Bhola", ["Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"], CHARGE.remote),
      ...zones("Pirojpur", ["Pirojpur Sadar", "Bhandaria", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad", "Zianagar"], CHARGE.district),
      ...zones("Barguna", ["Barguna Sadar", "Amtali", "Bamna", "Betagi", "Patharghata", "Taltali"], CHARGE.district),
      ...zones("Jhalokati", ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"], CHARGE.district),
    ],
  },
  {
    name: "Sylhet",
    districts: [
      ...zones("Sylhet", [
        ["Sylhet Sadar", ["Sylhet Sadar", "Zindabazar", "Amberkhana", "Shahjalal Uposhahar", "Bandar Bazar"]],
        "Balaganj",
        "Beanibazar",
        "Bishwanath",
        "Companiganj",
        "Dakshin Surma",
        "Fenchuganj",
        "Golapganj",
        "Gowainghat",
        "Jaintiapur",
        "Kanaighat",
        "Osmani Nagar",
        "Zakiganj",
      ], CHARGE.district),
      ...zones("Moulvibazar", ["Moulvibazar Sadar", "Barlekha", "Juri", "Kamalganj", "Kulaura", "Rajnagar", ["Sreemangal", ["Sreemangal Sadar", "Tea Garden"]]], CHARGE.district),
      ...zones("Habiganj", ["Habiganj Sadar", "Ajmiriganj", "Bahubal", "Baniachong", "Chunarughat", "Lakhai", "Madhabpur", "Nabiganj", "Shayestaganj"], CHARGE.district),
      ...zones("Sunamganj", ["Sunamganj Sadar", "Bishwamvarpur", "Chhatak", "Dakshin Sunamganj", "Derai", "Dharampasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Sullah", "Tahirpur"], CHARGE.district),
    ],
  },
  {
    name: "Rangpur",
    districts: [
      ...zones("Rangpur", [
        ["Rangpur Sadar", ["Rangpur Sadar", "Jahaj Company More", "Modern More", "Medical Mor"]],
        "Badarganj",
        "Gangachara",
        "Kaunia",
        "Mithapukur",
        "Pirgachha",
        "Pirganj",
        "Taraganj",
      ], CHARGE.district),
      ...zones("Dinajpur", ["Dinajpur Sadar", "Birampur", "Birganj", "Birol", "Bochaganj", "Chirirbandar", "Phulbari", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Nawabganj", "Parbatipur"], CHARGE.district),
      ...zones("Kurigram", ["Kurigram Sadar", "Bhurungamari", "Char Rajibpur", "Chilmari", "Phulbari", "Nageshwari", "Rajarhat", "Raomari", "Ulipur"], CHARGE.remote),
      ...zones("Gaibandha", ["Gaibandha Sadar", "Phulchhari", "Gobindaganj", "Palashbari", "Sadullapur", "Saghatta", "Sundarganj"], CHARGE.district),
      ...zones("Lalmonirhat", ["Lalmonirhat Sadar", "Aditmari", "Hatibandha", "Kaliganj", "Patgram"], CHARGE.district),
      ...zones("Nilphamari", ["Nilphamari Sadar", "Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Saidpur"], CHARGE.district),
      ...zones("Panchagarh", ["Panchagarh Sadar", "Atwari", "Boda", "Debiganj", "Tetulia"], CHARGE.district),
      ...zones("Thakurgaon", ["Thakurgaon Sadar", "Baliadangi", "Haripur", "Pirganj", "Ranisankail"], CHARGE.district),
    ],
  },
  {
    name: "Mymensingh",
    districts: [
      ...zones("Mymensingh", [
        ["Mymensingh Sadar", ["Mymensingh Sadar", "Ganginarpar", "Town Hall", "Maskanda"]],
        "Bhaluka",
        "Dhobaura",
        "Fulbaria",
        "Gaffargaon",
        "Gauripur",
        "Haluaghat",
        "Ishwarganj",
        "Muktagacha",
        "Nandail",
        "Phulpur",
        "Trishal",
        "Tarakanda",
      ], CHARGE.district),
      ...zones("Jamalpur", ["Jamalpur Sadar", "Bakshiganj", "Dewanganj", "Islampur", "Madarganj", "Melandaha", "Sarishabari"], CHARGE.district),
      ...zones("Netrokona", ["Netrokona Sadar", "Atpara", "Barhatta", "Durgapur", "Kalmakanda", "Kendua", "Khaliajuri", "Madan", "Mohanganj", "Purbadhala"], CHARGE.district),
      ...zones("Sherpur", ["Sherpur Sadar", "Jhenaigati", "Nakla", "Nalitabari", "Sreebardi"], CHARGE.district),
    ],
  },
];

function slugPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function locationKey(division, district, area) {
  return `${slugPart(division)}|${slugPart(district)}|${slugPart(area)}`;
}

export function formatLocation(location) {
  if (!location?.division || !location?.district || !location?.area) return "";
  return `${location.division}, ${location.district}, ${location.area}`;
}

function zoneTypeFromCharge(charge) {
  const value = Number(charge);
  if (value === CHARGE.remote) return "remote";
  if (value === CHARGE.dhakaCity) return "dhakaCity";
  if (value === CHARGE.chattogramCity) return "chattogramCity";
  if (value === CHARGE.greaterDhaka) return "greaterDhaka";
  return "district";
}

function extraList(extras) {
  return (Array.isArray(extras) ? extras : []).filter(
    (row) =>
      row &&
      row.is_active !== false &&
      row.division &&
      row.district &&
      row.area,
  );
}

function indexLocations() {
  const byKey = new Map();
  const flat = [];
  for (const division of BANGLADESH_LOCATIONS) {
    for (const district of division.districts) {
      for (const area of district.areas) {
        const charge = Number(area.charge) || 0;
        const zoneType = zoneTypeFromCharge(charge);
        const item = {
          key: locationKey(division.name, district.name, area.name),
          division: division.name,
          district: district.name,
          area: area.name,
          charge,
          zoneType,
          is_remote: zoneType === "remote",
        };
        byKey.set(item.key, item);
        flat.push(item);
      }
    }
  }
  return { byKey, flat };
}

const INDEX = indexLocations();

export function mergeLocations(extras = []) {
  const byKey = new Map();
  for (const item of INDEX.flat) {
    byKey.set(item.key, { ...item });
  }
  for (const row of extraList(extras)) {
    const key =
      row.location_key ||
      row.key ||
      locationKey(row.division, row.district, row.area);
    const existing = byKey.get(key);
    const isRemote = !!(row.is_remote || existing?.is_remote);
    byKey.set(key, {
      key,
      division: row.division,
      district: row.district,
      area: row.area,
      charge:
        row.charge != null && row.charge !== ""
          ? Number(row.charge)
          : existing?.charge ?? 0,
      is_remote: isRemote,
      is_custom: !existing,
      zoneType: isRemote ? "remote" : existing?.zoneType || "district",
    });
  }
  return { byKey, flat: [...byKey.values()] };
}

function locationSource(extras) {
  return extras?.length ? mergeLocations(extras) : INDEX;
}

export function getLocationByKey(key, extras) {
  if (!key) return null;
  return locationSource(extras).byKey.get(String(key)) || null;
}

export function searchLocations(query, { division, district, extras } = {}) {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  let list = locationSource(extras).flat;
  if (district) {
    list = list.filter(
      (item) => item.division === division && item.district === district,
    );
  } else if (division) {
    list = list.filter((item) => item.division === division);
  }
  if (!q) return list;
  return list.filter((item) => {
    const hay = `${item.division} ${item.district} ${item.area}`.toLowerCase();
    return hay.includes(q);
  });
}

export function getDivisions(extras) {
  const names = BANGLADESH_LOCATIONS.map((d) => d.name);
  for (const row of extraList(extras)) {
    if (!names.includes(row.division)) names.push(row.division);
  }
  return names;
}

export function getDistricts(divisionName, extras) {
  const division = BANGLADESH_LOCATIONS.find((d) => d.name === divisionName);
  const names = division ? division.districts.map((z) => z.name) : [];
  for (const row of extraList(extras)) {
    if (row.division === divisionName && !names.includes(row.district)) {
      names.push(row.district);
    }
  }
  return names;
}

export function getAreas(divisionName, districtName, extras) {
  const division = BANGLADESH_LOCATIONS.find((d) => d.name === divisionName);
  const district = division?.districts.find((z) => z.name === districtName);
  const areas = district ? district.areas.map((a) => ({ ...a })) : [];
  for (const row of extraList(extras)) {
    if (row.division !== divisionName || row.district !== districtName) continue;
    const existing = areas.find((a) => a.name === row.area);
    if (existing) {
      if (row.charge != null && row.charge !== "") {
        existing.charge = Number(row.charge);
      }
      existing.is_remote = !!row.is_remote;
    } else {
      areas.push({
        name: row.area,
        charge:
          row.charge != null && row.charge !== "" ? Number(row.charge) : 0,
        is_remote: !!row.is_remote,
      });
    }
  }
  return areas;
}
