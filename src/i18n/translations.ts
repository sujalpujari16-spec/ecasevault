export type SupportedLanguage = 'en' | 'mr' | 'hi';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  sublabel: string;
  badge: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    sublabel: 'Default Official Language',
    badge: 'EN',
  },
  {
    code: 'mr',
    label: 'Marathi',
    nativeLabel: 'मराठी',
    sublabel: 'महाराष्ट्र राज्य भाषा (State Official Language)',
    badge: 'मराठी',
  },
  {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    sublabel: 'राष्ट्रीय भाषा (National Language)',
    badge: 'हिंदी',
  },
];

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Top Bar & App Brand
    'app.title': 'e-CASEVAULT',
    'app.subtitle': 'DIGITAL EVIDENCE MANAGEMENT SYSTEM',
    'app.state': 'Government of Maharashtra',
    'app.search_placeholder': 'Search Case ID, FIR, IO, IPC sections...',
    'app.register_fir': 'Register FIR Docket',
    'app.command_alerts': 'Command Alerts',
    'app.logout': 'Log Out',
    'app.switch_language': 'Language',

    // Roles & Department Badges
    'role.POLICE': 'Police (Investigation)',
    'role.FORENSIC': 'Forensic (FSL Kalina)',
    'role.LEGAL': 'Legal (Public Prosecutor)',
    'role.AUDITOR': 'Auditor (CID Vigilance)',
    'role.ADMIN': 'Super Administrator',

    // Sidebar Navigation
    'nav.dashboard_overview': 'Dashboard',
    'nav.all_cases': 'All Cases',
    'nav.evidence_vault': 'Evidence Vault',
    'nav.member_management': 'Police Officers',
    'nav.crime_analytics': 'Reports & Statistics',
    'nav.audit_trail': 'Activity Log',
    'nav.users_permissions': 'Users & Permissions',
    'nav.access_requests': 'Case Access Requests',
    'nav.blockchain_ledger': 'Blockchain Ledger',
    'nav.cyber_security': 'Security & Threats',
    'nav.cctns_sync': 'CCTNS National Grid',
    'nav.identity_search': 'Face & Photo Search',
    'nav.law_assistant': 'Law Assistant',
    'action.submit_fsl_report': 'Submit FSL Report',
    'action.add_court_document': 'Add Court Document',

    // Dashboard Stat Cards & Metrics
    'stats.total_cases': 'Total Active Cases',
    'stats.under_investigation': 'Under Investigation',
    'stats.pending_review': 'Supervisory Review',
    'stats.chargesheet_ready': 'Charge-Sheet Ready',
    'stats.closed_cases': 'Closed / Disposed',
    'stats.total_evidence': 'Total Evidentiary Items',
    'stats.verified_evidence': 'SHA-256 Verified On-Chain',
    'stats.tamper_resistance': '100% Cryptographic Tamper-Proof',

    // Section Titles
    'section.quick_actions': 'Quick Operational Actions',
    'section.active_cases': 'Active Case Dockets',
    'section.evidence_repository': 'Case Repository & Evidence',
    'section.fabric_status': 'Hyperledger Fabric Multi-Org Status',
    'section.antivirus_status': 'ClamAV Security & Threat Shield',

    // Actions & Buttons
    'action.view_details': 'View Case',
    'action.open_3d': 'Open 3D Case Reader',
    'action.export_dossier': 'Export Dossier',
    'action.verify_integrity': 'Verify Integrity',
    'action.download_evidence': 'Download Evidence',
    'action.upload_document': 'Upload Document',
    'action.assign_io': 'Assign IO',
    'action.close_case': 'Close Case',
    'action.cancel': 'Cancel',
    'action.confirm': 'Confirm',
    'action.save': 'Save',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.all': 'All',

    // Evidence & Case Docket Statuses
    'status.under_investigation': 'Under Investigation',
    'status.charge_sheet_submitted': 'Charge-Sheet Submitted',
    'status.pending_review': 'Pending Supervisory Review',
    'status.closed': 'Closed / Disposed',
    'status.verified': 'Verified',
    'status.sealed': 'Collected & Sealed',
    'status.transferred': 'Transferred',

    // Security & Banner Info
    'security.clamav_active': 'ClamAV Real-Time Upload Shield Active',
    'security.hash_chain_active': 'SHA-256 Hash Chain Integrity Verified',
    'security.jurisdiction': 'Jurisdiction: Maharashtra Statewide Network',
    'security.confidential': 'CONFIDENTIAL — OFFICIAL LAW ENFORCEMENT RECORD',

    // Table Headers
    'table.case_id': 'Case ID / FIR',
    'table.title_class': 'Title & Classification',
    'table.station_io': 'Station & Assigned IO',
    'table.priority': 'Priority',
    'table.status': 'Status',
    'table.evidence': 'Evidence',
    'table.actions': 'Actions',
    'table.view': 'View',
    'table.cctns': 'CCTNS Forms',
    'table.unassigned': 'Unassigned',
    'filter.all_statuses': 'All Statuses',
    'filter.all_priorities': 'All Priorities',
    'filter.all_stations': 'All Stations',
    'filter.label': 'Filter:',
    'dashboard.title': 'Police Station Operations, FIR & Evidence Management',
    'dashboard.view_all': 'View All Cases',
    'dashboard.register_fir': 'Register FIR',
    'dashboard.priority_cases': 'Priority Cases Requiring Action',
    'dashboard.action_items': 'Action Items',
    'dashboard.assigned_officer': 'Assigned Officer:',
    'dashboard.unassigned': 'Unassigned (Pending)',
    'dashboard.status': 'Status:',
    'dashboard.evidences': 'Evidences',
    'dashboard.open_case': 'Open Case',
  },

  mr: {
    // Top Bar & App Brand
    'app.title': 'ई-केस व्हॉल्ट',
    'app.subtitle': 'डिजिटल पुरावा व्यवस्थापन प्रणाली',
    'app.state': 'महाराष्ट्र शासन',
    'app.search_placeholder': 'केस आयडी, एफआयआर क्र., तपास अधिकारी, कलमे शोधा...',
    'app.register_fir': 'नवीन एफआयआर नोंदवा',
    'app.command_alerts': 'कमांड सूचना',
    'app.logout': 'बाहेर पडा (लॉग आउट)',
    'app.switch_language': 'भाषा बदला',

    // Roles & Department Badges
    'role.POLICE': 'पोलीस (तपास विभाग)',
    'role.FORENSIC': 'फॉरेन्सिक (न्यायवैद्यक प्रयोगशाळा - कलिना)',
    'role.LEGAL': 'विधी व न्याय (सरकारी अभियोक्ता)',
    'role.AUDITOR': 'लेखापरीक्षक (सीआयडी दक्षता पथक)',
    'role.ADMIN': 'मुख्य प्रणाली प्रशासक',

    // Sidebar Navigation
    'nav.dashboard_overview': 'डॅशबोर्ड विहंगावलोकन',
    'nav.all_cases': 'सर्व खटले (केसेस)',
    'nav.evidence_vault': 'डिजिटल पुरावा व्हॉल्ट',
    'nav.member_management': 'अधिकारी व कर्मचारी यादी',
    'nav.crime_analytics': 'गुन्हे विश्लेषण व आकडेवारी',
    'nav.audit_trail': 'ऑडिट ट्रेल व हालचाली',
    'nav.users_permissions': 'वापरकर्ते व परवानग्या',
    'nav.access_requests': 'केस प्रवेश विनंत्या',
    'nav.blockchain_ledger': 'ब्लॉकचेन लेजर',
    'nav.cyber_security': 'सायबर सुरक्षा व धोके',
    'nav.cctns_sync': 'सीसीटीएनएस राष्ट्रीय ग्रीड',
    'nav.identity_search': 'चेहरा व फोटो शोध (Face Search)',
    'nav.law_assistant': 'कायदेविषयक सहाय्यक',
    'action.submit_fsl_report': 'एफएसएल (FSL) अहवाल सादर करा',
    'action.add_court_document': 'न्यायालयीन दस्तऐवज जोडा',

    // Dashboard Stat Cards & Metrics
    'stats.total_cases': 'एकूण सक्रिय खटले',
    'stats.under_investigation': 'तपासाधीन खटले',
    'stats.pending_review': 'पर्यवेक्षी तपासणी प्रलंबित',
    'stats.chargesheet_ready': 'दोषारोपपत्र तयार',
    'stats.closed_cases': 'निकाली / बंद खटले',
    'stats.total_evidence': 'एकूण डिजिटल पुरावे',
    'stats.verified_evidence': 'ब्लॉकचेनवर पडताळलेले पुरावे',
    'stats.tamper_resistance': '१००% फेरफार-प्रतिरोधक पुरावे',

    // Section Titles
    'section.quick_actions': 'त्वरित प्रशासकीय कृती',
    'section.active_cases': 'सक्रिय खटल्यांचे दस्तऐवज (डॉकेट्स)',
    'section.evidence_repository': 'केस भांडार व डिजिटल पुरावे',
    'section.fabric_status': 'हायपरलेजर फॅब्रिक ब्लॉकचेन स्थिती',
    'section.antivirus_status': 'क्लॅमएव्ही सुरक्षा व सायबर कवच',

    // Actions & Buttons
    'action.view_details': 'केस पहा',
    'action.open_3d': '३डी केस डायरी उघडा',
    'action.export_dossier': 'डॉसियर निर्यात करा',
    'action.verify_integrity': 'सत्यता पडताळा',
    'action.download_evidence': 'पुरावा डाउनलोड करा',
    'action.upload_document': 'कागदपत्र अपलोड करा',
    'action.assign_io': 'तपास अधिकारी नेमा',
    'action.close_case': 'केस बंद करा',
    'action.cancel': 'रद्द करा',
    'action.confirm': 'पुष्टी करा',
    'action.save': 'जतन करा',
    'action.search': 'शोधा',
    'action.filter': 'फिल्टर करा',
    'action.all': 'सर्व',

    // Evidence & Case Docket Statuses
    'status.under_investigation': 'तपासाधीन',
    'status.charge_sheet_submitted': 'दोषारोपपत्र दाखल',
    'status.pending_review': 'पर्यवेक्षी पुनरावलोकन प्रलंबित',
    'status.closed': 'निकाली / बंद',
    'status.verified': 'पडताळणी पूर्ण',
    'status.sealed': 'जप्त व सीलबंद',
    'status.transferred': 'हस्तांतरित',

    // Security & Banner Info
    'security.clamav_active': 'क्लॅमएव्ही रिअल-टाइम अँटीव्हायरस सुरक्षा सक्रिय',
    'security.hash_chain_active': 'एसएचए-२५६ हॅश साखळी अखंडता सत्यापित',
    'security.jurisdiction': 'अधिकारक्षेत्र: महाराष्ट्र राज्यव्यापी पोलीस जाळे',
    'security.confidential': 'गोपनीय — अधिकृत पोलीस कायदेशीर दस्तऐवज',

    // Table Headers
    'table.case_id': 'केस आयडी / एफआयआर',
    'table.title_class': 'शीर्षक व वर्गीकरण',
    'table.station_io': 'पोलीस ठाणे व तपास अधिकारी',
    'table.priority': 'प्राधान्य',
    'table.status': 'स्थिती',
    'table.evidence': 'पुरावा',
    'table.actions': 'कृती',
    'table.view': 'पहा',
    'table.cctns': 'सीसीटीएनएस',
    'table.unassigned': 'नेमणूक नाही',
    'filter.all_statuses': 'सर्व स्थिती',
    'filter.all_priorities': 'सर्व प्राधान्ये',
    'filter.all_stations': 'सर्व पोलीस ठाणी',
    'filter.label': 'फिल्टर करा:',
    'dashboard.title': 'पोलीस ठाणे कामकाज, एफआयआर आणि पुरावे व्यवस्थापन',
    'dashboard.view_all': 'सर्व खटले पहा',
    'dashboard.register_fir': 'एफआयआर नोंदवा',
    'dashboard.priority_cases': 'तातडीच्या कारवाईची आवश्यकता असलेले खटले',
    'dashboard.action_items': 'कृती आयटम',
    'dashboard.assigned_officer': 'नेमलेले अधिकारी:',
    'dashboard.unassigned': 'नेमलेले नाही (प्रलंबित)',
    'dashboard.status': 'स्थिती:',
    'dashboard.evidences': 'पुरावे',
    'dashboard.open_case': 'खटला उघडा',
  },

  hi: {
    // Top Bar & App Brand
    'app.title': 'ई-केस वॉल्ट',
    'app.subtitle': 'डिजिटल साक्ष्य प्रबंधन प्रणाली',
    'app.state': 'महाराष्ट्र शासन',
    'app.search_placeholder': 'केस आईडी, प्राथमिकी संख्या, जांच अधिकारी, धाराएं खोजें...',
    'app.register_fir': 'नई प्राथमिकी (FIR) दर्ज करें',
    'app.command_alerts': 'कमांड अलर्ट',
    'app.logout': 'लॉग आउट',
    'app.switch_language': 'भाषा बदलें',

    // Roles & Department Badges
    'role.POLICE': 'पुलिस (जांच विभाग)',
    'role.FORENSIC': 'फोरेंसिक (न्यायालयिक विज्ञान प्रयोगशाला - कलीना)',
    'role.LEGAL': 'कानूनी व अभियोजन (लोक अभियोजक)',
    'role.AUDITOR': 'लेखापरीक्षक (सीआईडी सतर्कता प्रकोष्ठ)',
    'role.ADMIN': 'मुख्य प्रणाली प्रशासक',

    // Sidebar Navigation
    'nav.dashboard_overview': 'डैशबोर्ड अवलोकन',
    'nav.all_cases': 'सभी मामले (केस)',
    'nav.evidence_vault': 'डिजिटल साक्ष्य वॉल्ट',
    'nav.member_management': 'अधिकारी एवं कार्मिक रोस्टर',
    'nav.crime_analytics': 'अपराध विश्लेषण और आंकड़े',
    'nav.audit_trail': 'ऑडिट ट्रेल और गतिविधियां',
    'nav.users_permissions': 'उपयोगकर्ता और अनुमतियां',
    'nav.access_requests': 'केस एक्सेस अनुरोध',
    'nav.blockchain_ledger': 'ब्लॉकचेन बहीखाता',
    'nav.cyber_security': 'सुरक्षा और खतरे',
    'nav.cctns_sync': 'सीसीटीएनएस राष्ट्रीय ग्रिड',
    'nav.identity_search': 'चेहरा और फोटो खोज (Face Search)',
    'nav.law_assistant': 'कानूनी सहायक',
    'action.submit_fsl_report': 'एफएसएल (FSL) रिपोर्ट जमा करें',
    'action.add_court_document': 'अदालती दस्तावेज़ जोड़ें',

    // Dashboard Stat Cards & Metrics
    'stats.total_cases': 'कुल सक्रिय मामले',
    'stats.under_investigation': 'जांच के अधीन',
    'stats.pending_review': 'पर्यवेक्षी समीक्षा लंबित',
    'stats.chargesheet_ready': 'आरोप-पत्र तैयार',
    'stats.closed_cases': 'निस्तारित / बंद मामले',
    'stats.total_evidence': 'कुल डिजिटल साक्ष्य',
    'stats.verified_evidence': 'ब्लॉकचेन सत्यापित साक्ष्य',
    'stats.tamper_resistance': '१००% छेड़छाड़-रोधी साक्ष्य',

    // Section Titles
    'section.quick_actions': 'त्वरित प्रशासनिक कार्य',
    'section.active_cases': 'सक्रिय केस दस्तावेज (डॉकेट्स)',
    'section.evidence_repository': 'केस भंडार एवं डिजिटल साक्ष्य',
    'section.fabric_status': 'हाइपरलेजर फैब्रिक ब्लॉकचेन स्थिति',
    'section.antivirus_status': 'क्लैमएवी सुरक्षा एवं खतरा ढाल',

    // Actions & Buttons
    'action.view_details': 'केस देखें',
    'action.open_3d': '३डी केस डायरी खोलें',
    'action.export_dossier': 'डोज़ियर निर्यात करें',
    'action.verify_integrity': 'सत्यनिष्ठा सत्यापित करें',
    'action.download_evidence': 'साक्ष्य डाउनलोड करें',
    'action.upload_document': 'दस्तावेज़ अपलोड करें',
    'action.assign_io': 'आईओ नियुक्त करें',
    'action.close_case': 'केस बंद करें',
    'action.cancel': 'रद्द करें',
    'action.confirm': 'पुष्टि करें',
    'action.save': 'सहेजें',
    'action.search': 'खोजें',
    'action.filter': 'फ़िल्टर करें',
    'action.all': 'सभी',

    // Evidence & Case Docket Statuses
    'status.under_investigation': 'जांच जारी',
    'status.charge_sheet_submitted': 'आरोप-पत्र दाखिल',
    'status.pending_review': 'पर्यवेक्षी समीक्षा लंबित',
    'status.closed': 'निस्तारित / बंद',
    'status.verified': 'सत्यापित',
    'status.sealed': 'जब्त एवं सीलबंद',
    'status.transferred': 'स्थानांतरित',

    // Security & Banner Info
    'security.clamav_active': 'क्लैमएवी रीयल-टाइम एंटीवायरस सुरक्षा सक्रिय',
    'security.hash_chain_active': 'एसएचए-२५६ हैश श्रृंखला सत्यनिष्ठा प्रमाणित',
    'security.jurisdiction': 'अधिकार क्षेत्र: महाराष्ट्र राज्यव्यापी पुलिस नेटवर्क',
    'security.confidential': 'गोपनीय — आधिकारिक पुलिस कानूनी अभिलेख',

    // Table Headers
    'table.case_id': 'केस आईडी / प्राथमिकी',
    'table.title_class': 'शीर्षक व वर्गीकरण',
    'table.station_io': 'पुलिस स्टेशन व जांच अधिकारी',
    'table.priority': 'प्राथमिकता',
    'table.status': 'स्थिति',
    'table.evidence': 'साक्ष्य',
    'table.actions': 'कार्रवाई',
    'table.view': 'देखें',
    'table.cctns': 'सीसीटीएनएस',
    'table.unassigned': 'नियुक्त नहीं',
    'filter.all_statuses': 'सभी स्थितियां',
    'filter.all_priorities': 'सभी प्राथमिकताएं',
    'filter.all_stations': 'सभी पुलिस स्टेशन',
    'filter.label': 'फ़िल्टर करें:',
    'dashboard.title': 'पुलिस स्टेशन संचालन, प्राथमिकी और साक्ष्य प्रबंधन',
    'dashboard.view_all': 'सभी मामले देखें',
    'dashboard.register_fir': 'प्राथमिकी दर्ज करें',
    'dashboard.priority_cases': 'प्राथमिकता वाले मामले जिनमें कार्रवाई आवश्यक है',
    'dashboard.action_items': 'कार्रवाई के मद',
    'dashboard.assigned_officer': 'नियुक्त अधिकारी:',
    'dashboard.unassigned': 'नियुक्त नहीं (लंबित)',
    'dashboard.status': 'स्थिति:',
    'dashboard.evidences': 'साक्ष्य',
    'dashboard.open_case': 'मामला खोलें',
  },
};
