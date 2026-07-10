/**
 * PDF Form Filler Utility
 * Uses pdf-lib to fill official VA PDF forms with veteran data
 *
 * VA Forms are public domain government documents.
 * We fetch them from local copies and fill in the actual form fields.
 *
 * Field mappings extracted from actual VA PDF forms using pdf-lib.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// VA Form URLs - these are the official PDF download links (kept for reference)
const VA_FORM_URLS = {
  "21-10210": "https://www.vba.va.gov/pubs/forms/VBA-21-10210-ARE.pdf", // Lay/Witness Statement
  "21-0966": "https://www.vba.va.gov/pubs/forms/VBA-21-0966-ARE.pdf", // Intent to File
  "21-4142": "https://www.vba.va.gov/pubs/forms/VBA-21-4142-ARE.pdf", // Medical Release
  "21-4142a": "https://www.vba.va.gov/pubs/forms/VBA-21-4142a-ARE.pdf", // General Release
  "21-4138": "https://www.vba.va.gov/pubs/forms/VBA-21-4138-ARE.pdf", // Statement in Support
  "21-0781": "https://www.vba.va.gov/pubs/forms/VBA-21-0781-ARE.pdf", // PTSD Stressor
  "20-10207": "https://www.vba.va.gov/pubs/forms/VBA-20-10207-ARE.pdf", // Priority Processing
};

// Local copies of VA forms
const LOCAL_FORM_PATHS = {
  "21-10210": "/forms/vba-21-10210-are.pdf", // Lay/Witness Statement (lowercase)
  "21-0966": "/forms/VBA-21-0966-ARE.pdf", // Intent to File
  "21-4142": "/forms/VBA-21-4142-ARE.pdf", // Medical Release
  "21-4142a": "/forms/VBA-21-4142a-ARE.pdf", // General Release
  "21-4138": "/forms/VBA-21-4138-ARE.pdf", // Statement in Support
  "21-0781": "/forms/VBA-21-0781-ARE.pdf", // PTSD Stressor Statement
  "20-10207": "/forms/VBA-20-10207-ARE.pdf", // Priority Processing
  "21-0845": "/forms/VBA-21-0845-ARE.pdf", // Third Party Authorization
  "20-10206": "/forms/VBA-20-10206-ARE.pdf", // Request for Personal Records
  "21-0972": "/forms/VBA-21-0972-ARE.pdf", // Alternate Signer
  "21-0779": "/forms/VBA-21-0779-ARE.pdf", // Nursing Home Information (NOT PTSD)
  "21P-0847": "/forms/VBA-21P-0847-ARE.pdf", // Request for Substitution
  "21P-0969": "/forms/VBA-21P-0969-ARE.pdf", // Income and Asset Statement
  "21P-8416": "/forms/VBA-21P-8416-ARE.pdf", // Medical Expense Report
  "21-22": "/forms/VBA-21-22-ARE.pdf", // VSO Appointment
  "21-22a": "/forms/VBA-21-22A-ARE.pdf", // Individual Representative
  "21-4192": "/forms/VBA-21-4192-ARE.pdf", // Request for Employment Information (TDIU)
};

/**
 * Actual PDF field names extracted from VA forms
 * These are the real field identifiers used in the official VA PDFs
 */
const VA_FORM_FIELDS = {
  // VA Form 21-10210 - Lay/Witness Statement
  "21-10210": {
    veteranFirstName: "vba210304[0].#subform[0].Veterans_First_Name[0]",
    veteranMiddleInitial: "vba210304[0].#subform[0].Middle_Initial1[0]",
    veteranLastName: "vba210304[0].#subform[0].Last_Name[0]",
    veteranSSN1: "vba210304[0].#subform[0].SSN1[0]",
    veteranSSN2: "vba210304[0].#subform[0].SSN2[0]",
    veteranSSN3: "vba210304[0].#subform[0].SSN3[0]",
    veteranDOBMonth: "vba210304[0].#subform[0].Month[1]",
    veteranDOBDay: "vba210304[0].#subform[0].Day[1]",
    veteranDOBYear: "vba210304[0].#subform[0].Year[1]",
    veteranFileNumber:
      "vba210304[0].#subform[0].VA_File_Number_If_Applicable[0]",
    veteranStreet:
      "vba210304[0].#subform[0].CurrentMailingAddress_NumberAndStreet[0]",
    veteranApt:
      "vba210304[0].#subform[0].CurrentMailingAddress_ApartmentOrUnitNumber[0]",
    veteranCity: "vba210304[0].#subform[0].CurrentMailingAddress_City[0]",
    veteranState:
      "vba210304[0].#subform[0].CurrentMailingAddress_StateOrProvince[0]",
    veteranZip5:
      "vba210304[0].#subform[0].CurrentMailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]",
    veteranZip4:
      "vba210304[0].#subform[0].CurrentMailingAddress_ZIPOrPostalCode_LastFourNumbers[0]",
    veteranCountry: "vba210304[0].#subform[0].CurrentMailingAddress_Country[0]",
    veteranPhone1: "vba210304[0].#subform[0].AreaCode[0]",
    veteranPhone2: "vba210304[0].#subform[0].FirstThreeNumbers[0]",
    veteranPhone3: "vba210304[0].#subform[0].LastFourNumbers[0]",
    veteranEmail: "vba210304[0].#subform[0].EMAIL_ADDRESS[0]",
    // Witness/Claimant info (Section 2)
    claimantFirstName: "vba210304[0].#subform[0].Veterans_First_Name[1]",
    claimantMiddleInitial: "vba210304[0].#subform[0].Middle_Initial1[1]",
    claimantLastName: "vba210304[0].#subform[0].Last_Name[1]",
    claimantSSN1: "vba210304[0].#subform[0].FirstThreeNumbers[1]",
    claimantSSN2: "vba210304[0].#subform[0].SecondTwoNumbers[0]",
    claimantSSN3: "vba210304[0].#subform[0].LastFourNumbers[1]",
    claimantDOBMonth: "vba210304[0].#subform[0].Month[3]",
    claimantDOBDay: "vba210304[0].#subform[0].Day[3]",
    claimantDOBYear: "vba210304[0].#subform[0].Year[3]",
    claimantStreet:
      "vba210304[0].#subform[0].CurrentMailingAddress_NumberAndStreet[1]",
    claimantCity: "vba210304[0].#subform[0].CurrentMailingAddress_City[1]",
    claimantState:
      "vba210304[0].#subform[0].CurrentMailingAddress_StateOrProvince[1]",
    claimantZip5:
      "vba210304[0].#subform[0].CurrentMailingAddress_ZIPOrPostalCode_FirstFiveNumbers[1]",
    claimantPhone1: "vba210304[0].#subform[0].AreaCode[1]",
    claimantPhone2: "vba210304[0].#subform[0].FirstThreeNumbers[2]",
    claimantPhone3: "vba210304[0].#subform[0].LastFourNumbers[2]",
    claimantEmail: "vba210304[0].#subform[0].EMAIL_ADDRESS[2]",
    // Statement content (Page 2)
    statementContent: "vba210304[0].#subform[1].TextField1[0]",
    // Witness info (Page 3)
    witnessFirstName: "vba210304[0].#subform[2].WITNESS_FIRST_NAME[0]",
    witnessMiddleInitial: "vba210304[0].#subform[2].Middle_Initial1[2]",
    witnessLastName: "vba210304[0].#subform[2].Last_Name[2]",
    witnessPhone1: "vba210304[0].#subform[2].AreaCode[2]",
    witnessPhone2: "vba210304[0].#subform[2].FirstThreeNumbers[3]",
    witnessPhone3: "vba210304[0].#subform[2].LastFourNumbers[3]",
    witnessEmail: "vba210304[0].#subform[2].EMAIL_ADDRESS[4]",
    witnessDateMonth: "vba210304[0].#subform[2].Month[5]",
    witnessDateDay: "vba210304[0].#subform[2].Day[5]",
    witnessDateYear: "vba210304[0].#subform[2].Year[5]",
    // Checkboxes for relationship
    relationServedWith: "vba210304[0].#subform[2].SERVED_WITH_CLAIMANT[0]",
    relationFamilyFriend:
      "vba210304[0].#subform[2].FAMILY_OR_FRIEND_OF_CLAIMANT[0]",
    relationCoworker:
      "vba210304[0].#subform[2].COWORKER_OR_SUPERVISOR_OF_CLAIMANT[0]",
    relationOther: "vba210304[0].#subform[2].OTHER_Specify[1]",
    relationOtherText: "vba210304[0].#subform[2].OTHER_Specify[0]",
  },

  // VA Form 21-4138 - Statement in Support of Claim
  "21-4138": {
    firstName: "form1[0].#subform[0].Veterans_Beneficiary_First_Name[0]",
    middleInitial: "form1[0].#subform[0].Middle_Initial1[0]",
    lastName: "form1[0].#subform[0].Last_Name[0]",
    ssn1: "form1[0].#subform[0].SocialSecurityNumber_FirstThreeNumbers[0]",
    ssn2: "form1[0].#subform[0].SocialSecurityNumber_SecondTwoNumbers[0]",
    ssn3: "form1[0].#subform[0].SocialSecurityNumber_LastFourNumbers[0]",
    vaFileNumber: "form1[0].#subform[0].VA_File_Number_If_Applicable[0]",
    dobMonth: "form1[0].#subform[0].Veterans_DOB_Month[0]",
    dobDay: "form1[0].#subform[0].DOB_Day[0]",
    dobYear: "form1[0].#subform[0].DOB_Year[0]",
    serviceNumber:
      "form1[0].#subform[0].Veterans_Service_Number_If_Applicable[0]",
    street: "form1[0].#subform[0].MailingAddress_NumberAndStreet[0]",
    apt: "form1[0].#subform[0].MailingAddress_ApartmentOrUnitNumber[0]",
    city: "form1[0].#subform[0].MailingAddress_City[0]",
    state: "form1[0].#subform[0].MailingAddress_StateOrProvince[0]",
    country: "form1[0].#subform[0].MailingAddress_Country[0]",
    zip5: "form1[0].#subform[0].MailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]",
    zip4: "form1[0].#subform[0].MailingAddress_ZIPOrPostalCode_LastFourNumbers[0]",
    phone1: "form1[0].#subform[0].TelephoneNumber_SecondThreeNumbers[0]",
    phone2: "form1[0].#subform[0].TelephoneNumber_FirstThreeNumbers[0]",
    phone3: "form1[0].#subform[0].TelephoneNumber_LastFourNumbers[0]",
    email: "form1[0].#subform[0].EMAIL_ADDRESS[0]",
    remarks: "form1[0].#subform[0].REMARKS[0]",
    remarksPage2: "form1[0].#subform[1].REMARKS[1]",
    dateMonth: "form1[0].#subform[1].Date_Signed_Month[0]",
    dateDay: "form1[0].#subform[1].Date_Signed_Day[0]",
    dateYear: "form1[0].#subform[1].Date_Signed_Year[0]",
  },

  // VA Form 21-0966 - Intent to File
  "21-0966": {
    veteranFirstName: "F[0].Page_1[0].Veterans_First_Name[0]",
    veteranMiddleInitial: "F[0].Page_1[0].Veterans_Middle_Initial1[0]",
    veteranLastName: "F[0].Page_1[0].Veterans_Last_Name[0]",
    veteranSSN1:
      "F[0].Page_1[0].Veterans_Social_SecurityNumber_FirstThreeNumbers[0]",
    veteranSSN2:
      "F[0].Page_1[0].Veterans_Social_SecurityNumber_SecondTwoNumbers[0]",
    veteranSSN3:
      "F[0].Page_1[0].VeteransSocialSecurityNumber_LastFourNumbers[0]",
    veteranDOBMonth: "F[0].Page_1[0].DOB_Month[0]",
    veteranDOBDay: "F[0].Page_1[0].DOB_Day[0]",
    veteranDOBYear: "F[0].Page_1[0].DOB_Year[0]",
    vaFileNumber: "F[0].Page_1[0].VA_File_Number[0]",
    serviceNumber: "F[0].Page_1[0].Veterans_Service_Number[0]",
    street: "F[0].Page_1[0].Mailing_Address_NumberAndStreet[0]",
    apt: "F[0].Page_1[0].Mailing_Address_ApartmentOrUnitNumber[0]",
    city: "F[0].Page_1[0].MailingAddress_City[0]",
    state: "F[0].Page_1[0].MailingAddress_StateOrProvince[0]",
    country: "F[0].Page_1[0].MailingAddress_Country[0]",
    zip5: "F[0].Page_1[0].MailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]",
    zip4: "F[0].Page_1[0].MailingAddress_ZIPOrPostalCode_LastFourNumbers[0]",
    phone1: "F[0].Page_1[0].Telephone_Number_FirstThreeNumbers[0]",
    phone2: "F[0].Page_1[0].Telephone_Number_SecondThreeNumbers[0]",
    phone3: "F[0].Page_1[0].Telephone_Number_LastFourNumbers[0]",
    email: "F[0].Page_1[0].EMAIL_ADDRESS[0]",
    // Benefit type checkboxes
    compensationCheckbox: "F[0].#subform[1].COMPENSATION[0]",
    pensionCheckbox: "F[0].#subform[1].PENSION[0]",
    dicCheckbox:
      "F[0].#subform[1].SURVIVORS_PENSION_AND_OR_DEPENDENCY_AND_INDEMNITY_COMPENSATION_DIC[0]",
    // Signature date
    dateMonth: "F[0].#subform[1].Date_Signed_Month[0]",
    dateDay: "F[0].#subform[1].Date_Signed_Day[0]",
    dateYear: "F[0].#subform[1].Date_Signed_Year[0]",
  },

  // VA Form 21-4142 - Medical Records Release
  "21-4142": {
    veteranFirstName: "F[0].Page_1[0].VeteranFirstName[0]",
    veteranMiddleInitial: "F[0].Page_1[0].VeteranMiddleInitial1[0]",
    veteranLastName: "F[0].Page_1[0].VeteranLastName[0]",
    veteranSSN1:
      "F[0].Page_1[0].VeteransSocialSecurityNumber_FirstThreeNumbers[0]",
    veteranSSN2:
      "F[0].Page_1[0].VeteransSocialSecurityNumber_SecondTwoNumbers[0]",
    veteranSSN3:
      "F[0].Page_1[0].VeteransSocialSecurityNumber_LastFourNumbers[0]",
    vaFileNumber: "F[0].Page_1[0].VAFileNumber[0]",
    dobMonth: "F[0].Page_1[0].DOBmonth[0]",
    dobDay: "F[0].Page_1[0].DOBday[0]",
    dobYear: "F[0].Page_1[0].DOByear[0]",
    serviceNumber: "F[0].Page_1[0].VeteransServiceNumber_If_Applicable[0]",
    street: "F[0].Page_1[0].MailingAddress_NumberAndStreet[0]",
  },

  // VA Form 20-10207 - Priority Processing
  "20-10207": {
    veteranFirstName: "form1[0].#subform[2].Veterans_Claimants_First_Name[0]",
    veteranMiddleInitial: "form1[0].#subform[2].Middle_Initial1[0]",
    veteranLastName: "form1[0].#subform[2].Last_Name[0]",
    veteranSSN1:
      "form1[0].#subform[2].VeteransSocialSecurityNumber_FirstThreeNumbers[0]",
    veteranSSN2:
      "form1[0].#subform[2].VeteransSocialSecurityNumber_SecondTwoNumbers[0]",
    veteranSSN3:
      "form1[0].#subform[2].VeteransSocialSecurityNumber_LastFourNumbers[0]",
    dobMonth: "form1[0].#subform[2].Month[1]",
    dobDay: "form1[0].#subform[2].Day[1]",
    dobYear: "form1[0].#subform[2].Year[1]",
    vaFileNumber: "form1[0].#subform[2].VA_File_Number_If_Applicable[0]",
    street: "form1[0].#subform[2].CurrentMailingAddress_NumberAndStreet[0]",
    apt: "form1[0].#subform[2].CurrentMailingAddress_ApartmentOrUnitNumber[0]",
    city: "form1[0].#subform[2].CurrentMailingAddress_City[0]",
    state: "form1[0].#subform[2].CurrentMailingAddress_StateOrProvince[0]",
    zip5: "form1[0].#subform[2].CurrentMailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]",
    zip4: "form1[0].#subform[2].CurrentMailingAddress_ZIPOrPostalCode_LastFourNumbers[0]",
    country: "form1[0].#subform[2].CurrentMailingAddress_Country[0]",
    phone1: "form1[0].#subform[2].TelephoneNumber_FirstThreeNumbers[0]",
    phone2: "form1[0].#subform[2].TelephoneNumber_SecondThreeNumbers[0]",
    phone3: "form1[0].#subform[2].TelephoneNumber_LastFourNumbers[0]",
    email: "form1[0].#subform[2].E_Mail_Address_If_Applicable[0]",
    // Reason checkboxes
    advancedIllness: "form1[0].#subform[3].Advance_Illness[0]",
    financialHardship: "form1[0].#subform[3].Financial_Hardship[0]",
    alsDisease: "form1[0].#subform[3].ALS_Disease[0]",
    over85: "form1[0].#subform[3].Over85YearsOld[0]",
    homelessAtRisk:
      "form1[0].#subform[3].ExperiencingOrAtRiskOfExperiencingHomelessness[0]",
    extremeFinancial: "form1[0].#subform[3].ExtremeFinancialHardship[0]",
    dateMonth: "form1[0].#subform[3].Month[2]",
    dateDay: "form1[0].#subform[3].Day[2]",
    dateYear: "form1[0].#subform[3].Year[2]",
  },

  // VA Form 21-0781 - PTSD Stressor Statement
  "21-0781": {
    // Section 1 - Veteran Information
    veteranFirstName: "F[0].#subform[2].Veterans_Service_Members_First_Name[0]",
    veteranMiddleInitial: "F[0].#subform[2].VeteransMiddleInitial1[0]",
    veteranLastName: "F[0].#subform[2].VeteransLastName[0]",
    vaFileNumber: "F[0].#subform[2].VAFileNumber[0]",
    serviceNumber: "F[0].#subform[2].VeteransServiceNumber[0]",
    ssn1: "F[0].#subform[2].SSN1[0]",
    ssn2: "F[0].#subform[2].SSN2[0]",
    ssn3: "F[0].#subform[2].SSN3[0]",
    dobMonth: "F[0].#subform[2].Month[0]",
    dobDay: "F[0].#subform[2].Day[0]",
    dobYear: "F[0].#subform[2].Year[0]",
    phoneArea: "F[0].#subform[2].AreaCode[0]",
    phonePrefix: "F[0].#subform[2].FirstThreeNumbers[0]",
    phoneLine: "F[0].#subform[2].LastFourNumbers[0]",
    intlPhone:
      "F[0].#subform[2].International_Telephone_Number_If_Applicable[0]",
    email: "F[0].#subform[2].E_Mail_Address_Optional[0]",

    // Stressor Type checkboxes
    combatTraumatic: "F[0].#subform[2].Combat_Traumatic_Events[0]",
    personalTraumaticNonMST:
      "F[0].#subform[2].Personal_Traumatic_Events_Not_Involving_Military_Sexual_Trauma[0]",
    personalTraumaticMST:
      "F[0].#subform[2].Personal_Traumatic_Events_Involving_Military_Sexual_Trauma[0]",
    otherTraumatic: "F[0].#subform[2].Other_Traumatic_Events[0]",

    // Stressor Event 1
    stressor1Description:
      "F[0].#subform[2].Brief_Description_Of_The_Traumatic_Events[0]",
    stressor1Location: "F[0].#subform[2].Location_Of_The_Traumatic_Events[0]",
    stressor1Dates: "F[0].#subform[2].Dates_The_Traumatic_Events_Occured[0]",

    // Stressor Event 2
    stressor2Description:
      "F[0].#subform[2].Brief_Description_Of_The_Traumatic_Events[1]",
    stressor2Location: "F[0].#subform[2].Location_Of_The_Traumatic_Events[1]",
    stressor2Dates: "F[0].#subform[2].Dates_The_Traumatic_Events_Occured[1]",

    // Stressor Event 3
    stressor3Description:
      "F[0].#subform[2].Brief_Description_Of_The_Traumatic_Events[2]",
    stressor3Location: "F[0].#subform[2].Location_Of_The_Traumatic_Events[2]",
    stressor3Dates: "F[0].#subform[2].Dates_The_Traumatic_Events_Occured[2]",

    // Behavioral Changes Checkboxes
    increasedHealthcareVisits:
      "F[0].#subform[3].Increased_Decreased_Visits_To_A_Healthcare_Professional_Counselor_Or_Treatment_Facility[0]",
    requestedDutyChange:
      "F[0].#subform[3].Request_For_A_Change_In_Occupational_Series_Or_Duty_Assignment[0]",
    changesInLeave: "F[0].#subform[3].Increased_Decreased_Use_Of_Leave[0]",
    performanceChanges:
      "F[0].#subform[3].Changes_In_Performance_Or_Performance_Evaluations[0]",
    depressionPanicAnxiety:
      "F[0].#subform[3].Episodes_Of_Depression_Panic_Attacks_Or_Anxiety[0]",
    prescriptionMedsChanges:
      "F[0].#subform[3].Increased_Decreased_Use_Of_Prescription_Medications[0]",
    otcMedsChanges:
      "F[0].#subform[3].Increased_Decreased_Use_Of_Over_The_Counter_Medications[0]",
    substanceUseChanges:
      "F[0].#subform[3].Increased_Decreased_Use_Of_Alcohol_Or_Drugs[0]",
    disciplinaryLegal: "F[0].#subform[3].Disciplinary_Or_Legal_Difficulties[0]",
    eatingHabitChanges:
      "F[0].#subform[3].Changes_In_Eating_Habits_Such_As_Overeating_Or_Undereating_Or_Significant_Changes_In_Weight[0]",
    pregnancyTests:
      "F[0].#subform[4].Pregnancy_Tests_Around_The_Time_Of_The_Traumatic_Events[0]",
    stiTests: "F[0].#subform[4].Tests_For_Sexually_Transmitted_Infections[0]",
    economicSocialChanges:
      "F[0].#subform[4].Economic_Or_Social_Behavioral_Changes[0]",
    relationshipChanges:
      "F[0].#subform[4].Changes_In_Or_Breakup_Of_A_Significant_Relationship[0]",

    // Additional behavioral info fields
    additionalBehaviorInfo0:
      "F[0].#subform[3].Additional_Information_About_Behavioral_Changes[0]",
    additionalBehaviorInfo1:
      "F[0].#subform[3].Additional_Information_About_Behavioral_Changes[1]",
    additionalBehaviorInfo2:
      "F[0].#subform[3].Additional_Information_About_Behavioral_Changes[2]",
    additionalBehaviorInfo3:
      "F[0].#subform[3].Additional_Information_About_Behavioral_Changes[3]",
    additionalBehaviorInfo4:
      "F[0].#subform[3].Additional_Information_About_Behavioral_Changes[4]",
    listAdditionalBehavioralChanges:
      "F[0].#subform[4].List_Additional_Behavioral_Changes[0]",

    // Reports - told someone checkboxes
    rapeCrisisCenter:
      "F[0].#subform[4].A_Rape_Crisis_Center_Or_Center_For_Domestic_Abuse[0]",
    counselingFacility:
      "F[0].#subform[4].A_Counseling_Facility_Or_Health_Clinic[0]",
    familyOrRoomates: "F[0].#subform[4].Family_Member_Or_Roomates[0]",
    facultyMember: "F[0].#subform[4].A_Faculty_Member[0]",
    civilianPolice: "F[0].#subform[4].Civilian_Police_Reports[0]",
    medicalReports:
      "F[0].#subform[4].Medical_Reports_From_Civilian_Physicians_Or_Caregivers_Who_Treated_You_Immediately_Following_The_Incident_Or_Sometime_Later[0]",
    chaplainClergy: "F[0].#subform[4].A_Chaplain_Or_Clergy[0]",
    fellowServiceMembers: "F[0].#subform[4].Fellow_Service_Members[0]",
    personalDiaries: "F[0].#subform[4].Personal_Diaries_Or_Journals[0]",
    policeReportLocation: "F[0].#subform[4].Police_Report_Location_If_Known[0]",
    otherReportText: "F[0].#subform[4].Other_Report[0]",

    // Treatment facilities
    privateProvider: "F[0].#subform[4].Private_Healthcare_Provider[0]",
    vaVetCenter: "F[0].#subform[4].VA_Vet_Center[0]",
    communityCarePaidByVA: "F[0].#subform[4].Community_Care_Paid_For_By_VA[0]",
    vaMedicalCenter:
      "F[0].#subform[4].VA_Medical_Center_And_Community_Based_Outpatient_Clinics[0]",
    dodTreatmentFacilities:
      "F[0].#subform[4].Department_Of_Defense_Military_Treatment_Facilities[0]",

    // Treatment facility details
    treatmentFacility1:
      "F[0].#subform[5].Name_And_Location_Of_Treatment_Facility[0]",
    treatmentFacility2:
      "F[0].#subform[5].Name_And_Location_Of_Treatment_Facility[1]",
    treatmentFacility3:
      "F[0].#subform[5].Name_And_Location_Of_Treatment_Facility[2]",
    treatmentDateMonth1: "F[0].#subform[5].Date_Of_Treatment_Month[0]",
    treatmentDateYear1: "F[0].#subform[5].Date_Of_Treatment_Year[0]",
    treatmentDateMonth2: "F[0].#subform[5].Date_Of_Treatment_Month[1]",
    treatmentDateYear2: "F[0].#subform[5].Date_Of_Treatment_Year[1]",
    noDateAvailable1: "F[0].#subform[5].Check_Box_Do_Not_Have_Date_s[0]",
    noDateAvailable2: "F[0].#subform[5].Check_Box_Do_Not_Have_Date_s[1]",

    // Remarks and consent
    remarks: "F[0].#subform[5].Remarks_If_Any[0]",
    consentVBA:
      "F[0].#subform[5].I_Consent_To_Have_VBA_Notify_VHA_About_Certain_Upcoming_Events_Related_To_My_Claim_And_Or_Appeal[0]",
    noConsentVBA:
      "F[0].#subform[5].I_Do_Not_Consent_To_Have_VBA_Notify_VHA_About_Certain_Upcoming_Events_Related_To_My_Claim_And_Or_Appeal[0]",
    revokeConsent:
      "F[0].#subform[5].I_Revoke_Prior_Consent_To_Have_VBA_Notify_VHA_About_Certain_Upcoming_Events_Related_To_My_Claim_And_Or_Appeal[0]",
    notEnrolledVHA:
      "F[0].#subform[5].Not_Applicable_And_Or_Not_Enrolled_In_VHA_Healthcare[0]",

    // Signature date
    signDateMonth: "F[0].#subform[5].Date_Signed_Month[0]",
    signDateDay: "F[0].#subform[5].Date_Signed_Day[0]",
    signDateYear: "F[0].#subform[5].Date_Signed_Year[0]",
  },

  // VA Form 21-22 - Appointment of Veterans Service Organization as Claimant's Representative
  "21-22": {
    // Veteran Information (Section 1-7)
    veteranFirstName: "form1[0].#subform[0].VeteransFirstName[0]",
    veteranMiddleInitial: "form1[0].#subform[0].VeteransMiddleInitial1[0]",
    veteranLastName: "form1[0].#subform[0].VeteransLastName[0]",
    veteranSSN1:
      "form1[0].#subform[0].SocialSecurityNumber_FirstThreeNumbers[0]",
    veteranSSN2:
      "form1[0].#subform[0].SocialSecurityNumber_SecondTwoNumbers[0]",
    veteranSSN3: "form1[0].#subform[0].SocialSecurityNumber_LastFourNumbers[0]",
    veteranDOBMonth: "form1[0].#subform[0].DOBmonth[0]",
    veteranDOBDay: "form1[0].#subform[0].DOBday[0]",
    veteranDOBYear: "form1[0].#subform[0].DOByear[0]",
    vaFileNumber: "form1[0].#subform[0].VAFileNumber[0]",
    serviceNumber:
      "form1[0].#subform[0].VeteransServiceNumber_If_Applicable[0]",
    insuranceNumber: "form1[0].#subform[0].InsuranceNumber_s[0]",
    veteranPhone: "form1[0].#subform[0].TelephoneNumber_IncludeAreaCode[0]",
    veteranEmail: "form1[0].#subform[0].EmailAddress_Optional[0]",

    // Claimant Information (Section 8-13) - if different from veteran
    claimantFirstName: "form1[0].#subform[0].Claimants_FirstName[0]",
    claimantMiddleInitial: "form1[0].#subform[0].Claimants_MiddleInitial1[0]",
    claimantLastName: "form1[0].#subform[0].Claimants_LastName[0]",
    claimantRelationship: "form1[0].#subform[0].Relationship_To_Veteran[0]",
    claimantStreet:
      "form1[0].#subform[0].Claimants_MailingAddress_NumberAndStreet[0]",
    claimantApt:
      "form1[0].#subform[0].Claimants_MailingAddress_ApartmentOrUnitNumber[0]",
    claimantCity: "form1[0].#subform[0].Claimants_MailingAddress_City[0]",
    claimantState:
      "form1[0].#subform[0].Claimants_MailingAddress_StateOrProvince[0]",
    claimantCountry: "form1[0].#subform[0].Claimants_MailingAddress_Country[0]",
    claimantZip5:
      "form1[0].#subform[0].Claimants_MailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]",
    claimantZip4:
      "form1[0].#subform[0].Claimants_MailingAddress_ZIPOrPostalCode_LastFourNumbers[0]",
    claimantPhone: "form1[0].#subform[0].TelephoneNumber_IncludeAreaCode[1]",
    claimantEmail: "form1[0].#subform[0].Claimants_EmailAddress_Optional[0]",

    // Service Organization Information (Section 14-16)
    organizationName: "form1[0].#subform[0].Name_Of_Service_Organization[0]",
    representativeName:
      "form1[0].#subform[0].Name_Of_Official_Representative[0]",
    representativeTitle:
      "form1[0].#subform[0].Job_Title_Of_Person_Named_In_Item15A[0]",
    representativeEmail: "form1[0].#subform[0].Email_Address[0]",
    organizationStreet:
      "form1[0].#subform[0].Claimants_MailingAddress_NumberAndStreet[1]",
    organizationApt:
      "form1[0].#subform[0].Claimants_MailingAddress_ApartmentOrUnitNumber[1]",
    organizationCity: "form1[0].#subform[0].Claimants_MailingAddress_City[1]",
    organizationState:
      "form1[0].#subform[0].Claimants_MailingAddress_StateOrProvince[1]",
    organizationCountry:
      "form1[0].#subform[0].Claimants_MailingAddress_Country[1]",
    organizationZip5:
      "form1[0].#subform[0].Claimants_MailingAddress_ZIPOrPostalCode_FirstFiveNumbers[1]",
    organizationZip4:
      "form1[0].#subform[0].Claimants_MailingAddress_ZIPOrPostalCode_LastFourNumbers[1]",
    appointmentDate: "form1[0].#subform[0].DateAppt[0]",

    // Page 2 - Authorization checkboxes
    vrAndEFile: "form1[0].#subform[1].V_R_And_E_FILE[0]",
    eduFile: "form1[0].#subform[1].EDU_FILE[0]",
    lgFile: "form1[0].#subform[1].LG_File[0]",
    insuranceFile: "form1[0].#subform[1].Insurance_File[0]",

    // Disclosure authorization
    authorizeDisclosure: "form1[0].#subform[1].I_Authorize[0]",
    drugAbuse: "form1[0].#subform[1].Drug_Abuse[0]",
    alcoholism: "form1[0].#subform[1].Alcoholism_Or_Alcohol_Abuse[0]",
    hivInfection:
      "form1[0].#subform[1].Infection_With_The_Human_Immunodeficiency_Virus_HIV[0]",
    sickleCellAnemia: "form1[0].#subform[1].sicklecellanemia[0]",
    authorizeChange: "form1[0].#subform[1].I_Authorize[1]",

    // Signatures and dates
    claimantSignDate: "form1[0].#subform[1].DateSigned[0]",
    representativeSignDate: "form1[0].#subform[1].DateSigned[1]",
    revokedReason: "form1[0].#subform[1].REVOKED_Reason_And_Date[0]",
    dateSent: "form1[0].#subform[1].DateSent[0]",
    dateAcknowledged: "form1[0].#subform[1].Date_Acknowledged[0]",
    dateRevoked: "form1[0].#subform[1].DateRevoked[0]",

    // Page 2 SSN (continuation)
    page2SSN1: "form1[0].#subform[1].SocialSecurityNumber_FirstThreeNumbers[1]",
    page2SSN2: "form1[0].#subform[1].SocialSecurityNumber_SecondTwoNumbers[1]",
    page2SSN3: "form1[0].#subform[1].SocialSecurityNumber_LastFourNumbers[1]",
  },

  // VA Form 21-22a - Appointment of Individual as Claimant's Representative
  "21-22a": {
    // Veteran Information
    veteranFirstName: "form1[0].#subform[0].Veterans_First_Name[0]",
    veteranMiddleInitial: "form1[0].#subform[0].Veterans_Middle_Initial[0]",
    veteranLastName: "form1[0].#subform[0].Veterans_Last_Name[0]",
    veteranSSN1:
      "form1[0].#subform[0].SocialSecurityNumber_FirstThreeNumbers[0]",
    veteranSSN2:
      "form1[0].#subform[0].SocialSecurityNumber_SecondTwoNumbers[0]",
    veteranSSN3: "form1[0].#subform[0].SocialSecurityNumber_LastFourNumbers[0]",
    veteranDOBMonth: "form1[0].#subform[0].Date_Of_Birth_Month[0]",
    veteranDOBDay: "form1[0].#subform[0].Date_Of_Birth_Day[0]",
    veteranDOBYear: "form1[0].#subform[0].Date_Of_Birth_Year[0]",
    vaFileNumber:
      "form1[0].#subform[0].Veterans_Service_Number_If_Applicable[1]",
    serviceNumber:
      "form1[0].#subform[0].Veterans_Service_Number_If_Applicable[0]",
    veteranPhone1: "form1[0].#subform[0].Telephone_Number_Area_Code[0]",
    veteranPhone2: "form1[0].#subform[0].Telphone_Middle_Three_Numbers[0]",
    veteranPhone3: "form1[0].#subform[0].Telephone_Last_Four_Numbers[0]",
    veteranIntlPhone:
      "form1[0].#subform[0].International_Telephone_Number_If_Applicable[0]",
    veteranEmail: "form1[0].#subform[0].E_Mail_Address_Optional[0]",

    // Claimant Information (if not the veteran)
    claimantFirstName: "form1[0].#subform[0].Claimants_First_Name[0]",
    claimantMiddleInitial: "form1[0].#subform[0].Claimants_Middle_Initial[0]",
    claimantLastName: "form1[0].#subform[0].Claimants_Last_Name[0]",
    claimantRelationship: "form1[0].#subform[0].RelationshipToVeteran[0]",
    claimantDOBMonth: "form1[0].#subform[0].Claimants_Date_Of_Birth_Month[0]",
    claimantDOBDay: "form1[0].#subform[0].Date_Of_Birth_Day[1]",
    claimantDOBYear: "form1[0].#subform[0].Date_Of_Birth_Year[1]",
    claimantStreet: "form1[0].#subform[0].MailingAddress_NumberAndStreet[0]",
    claimantApt: "form1[0].#subform[0].MailingAddress_ApartmentOrUnitNumber[0]",
    claimantCity: "form1[0].#subform[0].MailingAddress_City[0]",
    claimantState: "form1[0].#subform[0].MailingAddress_StateOrProvince[0]",
    claimantCountry: "form1[0].#subform[0].MailingAddress_Country[0]",
    claimantZip5:
      "form1[0].#subform[0].MailingAddress_ZIPOrPostalCode_FirstFiveNumbers[0]",
    claimantZip4:
      "form1[0].#subform[0].MailingAddress_ZIPOrPostalCode_LastFourNumbers[0]",
    claimantPhone1: "form1[0].#subform[0].Telephone_Number_Area_Code[1]",
    claimantPhone2: "form1[0].#subform[0].Telephone_Middle_Three_Numbers[0]",
    claimantPhone3: "form1[0].#subform[0].Telephone_Last_Four_Numbers[1]",
    claimantIntlPhone:
      "form1[0].#subform[0].International_Telephone_Number_If_Applicable[1]",
    claimantEmail: "form1[0].#subform[0].E_Mail_Address_Optional[1]",

    // Representative Information
    representativeFirstName:
      "form1[0].#subform[0].Name_Of_Individual_Appointed_As_Representative_First_Name[0]",
    representativeMiddleInitial: "form1[0].#subform[0].Middle_Initial[0]",
    representativeLastName: "form1[0].#subform[0].Last_Name[0]",
    representativeOrganization: "form1[0].#subform[0].Specify_Organization[0]",
    representativeType: "form1[0].#subform[0].RadioButtonList[0]", // Attorney or Claims Agent
    representativeLicensed: "form1[0].#subform[0].RadioButtonList[1]", // Licensed in US

    // Page 2 - Representative Address and Authorization
    page2SSN1: "form1[0].#subform[1].SocialSecurityNumber_FirstThreeNumbers[1]",
    page2SSN2: "form1[0].#subform[1].SocialSecurityNumber_SecondTwoNumbers[1]",
    page2SSN3: "form1[0].#subform[1].SocialSecurityNumber_LastFourNumbers[1]",
    firmName:
      "form1[0].#subform[1].Provide_The_Name_Of_The_Firm_Or_Organization_Here[0]",
    additionalReps:
      "form1[0].#subform[1].Provide_The_Names_Of_The_Individuals_Here[0]",
    repStreet: "form1[0].#subform[1].MailingAddress_NumberAndStreet[2]",
    repApt: "form1[0].#subform[1].MailingAddress_ApartmentOrUnitNumber[2]",
    repCity: "form1[0].#subform[1].MailingAddress_City[2]",
    repState: "form1[0].#subform[1].MailingAddress_StateOrProvince[2]",
    repCountry: "form1[0].#subform[1].MailingAddress_Country[2]",
    repZip5:
      "form1[0].#subform[1].MailingAddress_ZIPOrPostalCode_FirstFiveNumbers[2]",
    repZip4:
      "form1[0].#subform[1].MailingAddress_ZIPOrPostalCode_LastFourNumbers[2]",
    repPhone1: "form1[0].#subform[1].Telephone_Number_Area_Code[2]",
    repPhone2: "form1[0].#subform[1].Telephone_Middle_Three_Numbers[1]",
    repPhone3: "form1[0].#subform[1].Telephone_Last_Four_Numbers[2]",
    repIntlPhone:
      "form1[0].#subform[1].International_Telephone_Number_If_Applicable[2]",
    repEmail:
      "form1[0].#subform[1].E_Mail_Address_Of_Individual_Appointed_As_Claimants_Representative_Optional[0]",

    // Authorization checkboxes
    authorizeRecordAccess:
      "form1[0].#subform[1].AuthorizationForRepAccessToRecords[0]",
    authorizeActOnBehalf:
      "form1[0].#subform[1].AuthorizationForRepActClaimantsBehalf[0]",
    authorizeDisclosure1:
      "form1[0].#subform[1].Checkbox_I_Authorize_VA_To_Disclose_All_My_Records_Other_Than_As_Provided_In_Items_20_And_21[0]",
    authorizeDisclosure2:
      "form1[0].#subform[1].Checkbox_I_Authorize_VA_To_Disclose_All_My_Records_Other_Than_As_Provided_In_Items_20_And_21[1]",

    // Signature dates
    claimantSignDateMonth: "form1[0].#subform[1].Date_Signed_Month[0]",
    claimantSignDateDay: "form1[0].#subform[1].Date_Signed_Day[0]",
    claimantSignDateYear: "form1[0].#subform[1].Date_Signed_Year[0]",
    repSignDateMonth: "form1[0].#subform[1].Date_Signed_Month[1]",
    repSignDateDay: "form1[0].#subform[1].Date_Signed_Day[1]",
    repSignDateYear: "form1[0].#subform[1].Date_Signed_Year[1]",

    // Page 3 - Limitations (if any)
    limitations: "form1[0].#subform[2].LIMITATIONS[0]",
    page3SSN1: "form1[0].#subform[2].SocialSecurityNumber_FirstThreeNumbers[2]",
    page3SSN2: "form1[0].#subform[2].SocialSecurityNumber_SecondTwoNumbers[2]",
    page3SSN3: "form1[0].#subform[2].SocialSecurityNumber_LastFourNumbers[2]",
    page3SignDateMonth: "form1[0].#subform[2].Date_Signed_Month[2]",
    page3SignDateDay: "form1[0].#subform[2].Date_Signed_Day[2]",
    page3SignDateYear: "form1[0].#subform[2].Date_Signed_Year[2]",
    page3RepSignDateMonth: "form1[0].#subform[2].Date_Signed_Month[3]",
    page3RepSignDateDay: "form1[0].#subform[2].Date_Signed_Day[3]",
    page3RepSignDateYear: "form1[0].#subform[2].Date_Signed_Year[3]",
  },
};

/**
 * Fetch a PDF form from VA.gov or local fallback
 */
async function fetchPdfForm(formNumber) {
  const vaUrl = VA_FORM_URLS[formNumber];
  const localPath = LOCAL_FORM_PATHS[formNumber];

  // Try VA.gov first
  try {
    const response = await fetch(vaUrl);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(
      `Could not fetch from VA.gov (${error.message}), trying local fallback...`,
    );
  }

  // Try local fallback
  try {
    const response = await fetch(localPath);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`Local fallback also failed: ${error.message}`);
  }

  return null;
}

/**
 * Get form field names from a PDF (useful for debugging/mapping)
 */
export async function getFormFieldNames(formNumber) {
  const pdfBytes = await fetchPdfForm(formNumber);
  if (!pdfBytes) {
    throw new Error(`Could not load form ${formNumber}`);
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  return fields.map((field) => ({
    name: field.getName(),
    type: field.constructor.name,
  }));
}

/**
 * Parse a raw phone string into area/prefix/line digit groups
 */
function parsePhoneParts(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return {
    area: digits.substring(0, 3),
    prefix: digits.substring(3, 6),
    line: digits.substring(6, 10),
  };
}

/**
 * Parse a raw SSN string into first/middle/last digit groups
 */
function parseSSNParts(ssn) {
  const digits = (ssn || "").replace(/\D/g, "");
  return {
    first: digits.substring(0, 3),
    middle: digits.substring(3, 5),
    last: digits.substring(5, 9),
  };
}

/**
 * Parse a date of birth string (MM/DD/YYYY or YYYY-MM-DD) into parts
 */
function parseDOBParts(dob) {
  if (!dob) return { month: "", day: "", year: "" };
  const parts = dob.split(/[-/]/);
  if (parts.length === 3) {
    // Assume MM/DD/YYYY or YYYY-MM-DD format
    if (parts[0].length === 4) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }
    return { month: parts[0], day: parts[1], year: parts[2] };
  }
  return { month: "", day: "", year: "" };
}

/**
 * Parse a raw ZIP code string into 5-digit/4-digit groups
 */
function parseZipParts(zip) {
  const digits = (zip || "").replace(/\D/g, "");
  return { five: digits.substring(0, 5), four: digits.substring(5, 9) };
}

/**
 * Get today's date split into padded month/day/year parts
 */
function getTodayParts() {
  const today = new Date();
  return {
    month: String(today.getMonth() + 1).padStart(2, "0"),
    day: String(today.getDate()).padStart(2, "0"),
    year: String(today.getFullYear()),
  };
}

/**
 * Safely set a PDF text field's value, ignoring fields that don't exist
 */
function setPdfTextField(form, fieldName, value) {
  if (!value) return;
  try {
    const field = form.getTextField(fieldName);
    if (field) field.setText(String(value));
  } catch {
    // eslint-disable-next-line no-console
    console.log(`Field not found: ${fieldName}`);
  }
}

/**
 * Safely check a PDF checkbox, ignoring fields that don't exist
 */
function setPdfCheckbox(form, fieldName, checked) {
  try {
    const field = form.getCheckBox(fieldName);
    if (field && checked) field.check();
  } catch {
    // eslint-disable-next-line no-console
    console.log(`Checkbox not found: ${fieldName}`);
  }
}

/**
 * Wrap text into lines that fit within maxWidth for the given font/size
 */
function wrapTextToLines(font, text, fontSize, maxWidth = 500) {
  const words = (text || "").split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const testLine = line + (line ? " " : "") + word;
    const textWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (textWidth > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Create a drawText function that paginates onto a new letter-size page
 * once the current page runs out of vertical space
 */
function makePaginatedDrawText(
  pdfDoc,
  font,
  fontBold,
  height,
  getPage,
  setPage,
  getY,
  setY,
) {
  return (text, options = {}) => {
    if (getY() < 80) {
      setPage(pdfDoc.addPage([612, 792]));
      setY(height - 50);
    }
    getPage().drawText(text || "", {
      x: 50,
      y: getY(),
      size: options.size || 11,
      font: options.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    setY(getY() - 14);
  };
}

/**
 * Create a drawText function for a single fixed page (no pagination)
 */
function makeFlatDrawText(font, fontBold, page, getY, setY) {
  return (text, options = {}) => {
    page.drawText(text || "", {
      x: 50,
      y: getY(),
      size: options.size || 11,
      font: options.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    setY(getY() - 14);
  };
}

/**
 * Fill VA Form 21-10210 (Lay/Witness Statement) with actual field mappings
 */
function fill21_10210_VeteranSection(setTextField, fieldMap, data) {
  const vetNameParts = (data.veteranName || "").split(" ");
  const vetPhone = parsePhoneParts(data.veteranPhone);
  const vetSSN = parseSSNParts(data.veteranSSN);
  const vetDOB = parseDOBParts(data.veteranDOB);
  const vetZip = parseZipParts(data.veteranZip);

  setTextField(fieldMap.veteranFirstName, vetNameParts[0]);
  setTextField(
    fieldMap.veteranMiddleInitial,
    vetNameParts.length > 2 ? vetNameParts[1]?.[0] : "",
  );
  setTextField(
    fieldMap.veteranLastName,
    vetNameParts[vetNameParts.length - 1],
  );
  setTextField(fieldMap.veteranSSN1, vetSSN.first);
  setTextField(fieldMap.veteranSSN2, vetSSN.middle);
  setTextField(fieldMap.veteranSSN3, vetSSN.last);
  setTextField(fieldMap.veteranDOBMonth, vetDOB.month);
  setTextField(fieldMap.veteranDOBDay, vetDOB.day);
  setTextField(fieldMap.veteranDOBYear, vetDOB.year);
  setTextField(fieldMap.veteranFileNumber, data.vaFileNumber || "");
  setTextField(fieldMap.veteranStreet, data.veteranStreet || "");
  setTextField(fieldMap.veteranApt, data.veteranApt || "");
  setTextField(fieldMap.veteranCity, data.veteranCity || "");
  setTextField(fieldMap.veteranState, data.veteranState || "");
  setTextField(fieldMap.veteranZip5, vetZip.five);
  setTextField(fieldMap.veteranZip4, vetZip.four);
  setTextField(fieldMap.veteranCountry, data.veteranCountry || "USA");
  setTextField(fieldMap.veteranPhone1, vetPhone.area);
  setTextField(fieldMap.veteranPhone2, vetPhone.prefix);
  setTextField(fieldMap.veteranPhone3, vetPhone.line);
  setTextField(fieldMap.veteranEmail, data.veteranEmail || "");
}

function fill21_10210_ClaimantSection(setTextField, fieldMap, data) {
  const claimantNameParts = (
    data.claimantName ||
    data.witnessName ||
    ""
  ).split(" ");
  const claimantPhone = parsePhoneParts(
    data.claimantPhone || data.witnessPhone,
  );
  const claimantZip = parseZipParts(data.claimantZip || data.witnessZip);

  setTextField(fieldMap.claimantFirstName, claimantNameParts[0]);
  setTextField(
    fieldMap.claimantMiddleInitial,
    claimantNameParts.length > 2 ? claimantNameParts[1]?.[0] : "",
  );
  setTextField(
    fieldMap.claimantLastName,
    claimantNameParts[claimantNameParts.length - 1],
  );
  setTextField(
    fieldMap.claimantStreet,
    data.claimantStreet || data.witnessStreet || "",
  );
  setTextField(
    fieldMap.claimantCity,
    data.claimantCity || data.witnessCity || "",
  );
  setTextField(
    fieldMap.claimantState,
    data.claimantState || data.witnessState || "",
  );
  setTextField(fieldMap.claimantZip5, claimantZip.five);
  setTextField(fieldMap.claimantPhone1, claimantPhone.area);
  setTextField(fieldMap.claimantPhone2, claimantPhone.prefix);
  setTextField(fieldMap.claimantPhone3, claimantPhone.line);
  setTextField(
    fieldMap.claimantEmail,
    data.claimantEmail || data.witnessEmail || "",
  );
}

function build21_10210_Statement(data) {
  let fullStatement = "";
  if (data.howKnown)
    fullStatement += `HOW I KNOW THE VETERAN:\n${data.howKnown}\n\n`;
  if (data.whatObserved)
    fullStatement += `WHAT I PERSONALLY OBSERVED:\n${data.whatObserved}\n\n`;
  if (data.whenObserved) fullStatement += `WHEN: ${data.whenObserved}\n`;
  if (data.whereObserved)
    fullStatement += `WHERE: ${data.whereObserved}\n\n`;
  if (data.dailyImpact)
    fullStatement += `IMPACT ON DAILY LIFE:\n${data.dailyImpact}\n\n`;
  if (data.workImpact)
    fullStatement += `IMPACT ON WORK:\n${data.workImpact}\n\n`;
  if (data.additionalInfo)
    fullStatement += `ADDITIONAL INFORMATION:\n${data.additionalInfo}\n`;
  return fullStatement.trim();
}

function fill21_10210_RelationshipCheckbox(
  setTextField,
  setCheckbox,
  fieldMap,
  data,
) {
  const relation = (data.witnessRelation || "").toLowerCase();
  if (
    relation.includes("served") ||
    relation.includes("military") ||
    relation.includes("unit")
  ) {
    setCheckbox(fieldMap.relationServedWith, true);
  } else if (
    relation.includes("family") ||
    relation.includes("friend") ||
    relation.includes("spouse") ||
    relation.includes("parent")
  ) {
    setCheckbox(fieldMap.relationFamilyFriend, true);
  } else if (
    relation.includes("coworker") ||
    relation.includes("supervisor") ||
    relation.includes("work")
  ) {
    setCheckbox(fieldMap.relationCoworker, true);
  } else if (relation) {
    setCheckbox(fieldMap.relationOther, true);
    setTextField(fieldMap.relationOtherText, data.witnessRelation);
  }
}

function fill21_10210_WitnessSection(
  setTextField,
  setCheckbox,
  fieldMap,
  data,
) {
  const witnessNameParts = (data.witnessName || "").split(" ");
  const witnessPhone = parsePhoneParts(data.witnessPhone);
  const todayParts = getTodayParts();

  setTextField(fieldMap.witnessFirstName, witnessNameParts[0]);
  setTextField(
    fieldMap.witnessMiddleInitial,
    witnessNameParts.length > 2 ? witnessNameParts[1]?.[0] : "",
  );
  setTextField(
    fieldMap.witnessLastName,
    witnessNameParts[witnessNameParts.length - 1],
  );
  setTextField(fieldMap.witnessPhone1, witnessPhone.area);
  setTextField(fieldMap.witnessPhone2, witnessPhone.prefix);
  setTextField(fieldMap.witnessPhone3, witnessPhone.line);
  setTextField(fieldMap.witnessEmail, data.witnessEmail || "");
  setTextField(fieldMap.witnessDateMonth, todayParts.month);
  setTextField(fieldMap.witnessDateDay, todayParts.day);
  setTextField(fieldMap.witnessDateYear, todayParts.year);

  fill21_10210_RelationshipCheckbox(setTextField, setCheckbox, fieldMap, data);
}

export async function fillForm21_10210(data) {
  const pdfBytes = await fetchPdfForm("21-10210");
  const fieldMap = VA_FORM_FIELDS["21-10210"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);
      const setCheckbox = (fieldName, checked) =>
        setPdfCheckbox(form, fieldName, checked);

      fill21_10210_VeteranSection(setTextField, fieldMap, data);
      fill21_10210_ClaimantSection(setTextField, fieldMap, data);
      setTextField(fieldMap.statementContent, build21_10210_Statement(data));
      fill21_10210_WitnessSection(setTextField, setCheckbox, fieldMap, data);

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 21-10210:", error);
    }
  }

  // Fallback: Create a clean formatted PDF document
  return createBuddyStatementPdf(data);
}

function drawBuddyStatementHeader(drawText, drawLine, adjustY) {
  drawText("STATEMENT IN SUPPORT OF CLAIM", { bold: true, size: 14 });
  drawText("(Attachment for VA Form 21-10210)", { size: 10 });
  adjustY(-10);
  drawLine();
  adjustY(-10);
}

function drawBuddyStatementWitnessInfo(drawText, adjustY, data) {
  drawText("SECTION I - PERSON PROVIDING STATEMENT", { bold: true });
  adjustY(-5);
  drawText(`Full Name: ${data.witnessName || "_______________________"}`);
  drawText(
    `Relationship to Veteran: ${data.witnessRelation || "_______________________"}`,
  );
  drawText(`Phone: ${data.witnessPhone || "_______________________"}`);
  drawText(`Email: ${data.witnessEmail || "_______________________"}`);
  adjustY(-10);
}

function drawBuddyStatementVeteranInfo(drawText, adjustY, data) {
  drawText("SECTION II - VETERAN INFORMATION", { bold: true });
  adjustY(-5);
  drawText(`Veteran Name: ${data.veteranName || "_______________________"}`);
  drawText(
    `Branch of Service: ${data.veteranBranch || "_______________________"}`,
  );
  drawText(`Condition: ${data.conditionName || "_______________________"}`);
  adjustY(-10);
}

function drawBuddyStatementBody(drawText, drawWrappedText, adjustY, data) {
  drawText("SECTION III - STATEMENT", { bold: true });
  adjustY(-5);

  if (data.howKnown) {
    drawText("How I Know the Veteran:", { bold: true, size: 10 });
    drawWrappedText(data.howKnown);
    adjustY(-5);
  }

  if (data.whatObserved) {
    drawText("What I Personally Observed:", { bold: true, size: 10 });
    drawWrappedText(data.whatObserved);
    adjustY(-5);
  }

  if (data.whenObserved) {
    drawText(`When: ${data.whenObserved}`);
  }
  if (data.whereObserved) {
    drawText(`Where: ${data.whereObserved}`);
  }

  if (data.dailyImpact) {
    adjustY(-5);
    drawText("Impact on Daily Life:", { bold: true, size: 10 });
    drawWrappedText(data.dailyImpact);
  }

  if (data.workImpact) {
    adjustY(-5);
    drawText("Impact on Work:", { bold: true, size: 10 });
    drawWrappedText(data.workImpact);
  }
}

function drawBuddyStatementCertification(
  drawText,
  drawWrappedText,
  drawLine,
  adjustY,
  data,
) {
  adjustY(-20);
  drawLine();

  drawText("CERTIFICATION", { bold: true });
  adjustY(-5);
  drawWrappedText(
    "I certify under penalty of perjury that the statements made herein are true and correct to the best of my knowledge and belief.",
  );
  adjustY(-20);

  drawText("Signature: _______________________________________");
  adjustY(-5);
  drawText(`Printed Name: ${data.witnessName || "_______________________"}`);
  drawText(`Date: ${new Date().toLocaleDateString()}`);
}

/**
 * Create a professional buddy statement PDF (fallback when form fill fails)
 */
async function createBuddyStatementPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 11;
  const lineHeight = 14;

  const page = pdfDoc.addPage([612, 792]);
  const { _width, height } = page.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = (text, options = {}) => {
    const { bold = false, size = fontSize, indent = 50 } = options;
    page.drawText(text, {
      x: indent,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  };

  const drawWrappedText = (text, maxWidth = 500) => {
    wrapTextToLines(font, text, fontSize, maxWidth).forEach((line) =>
      drawText(line),
    );
  };

  const drawLine = () => {
    page.drawLine({
      start: { x: 50, y },
      end: { x: 562, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 10;
  };

  drawBuddyStatementHeader(drawText, drawLine, adjustY);
  drawBuddyStatementWitnessInfo(drawText, adjustY, data);
  drawBuddyStatementVeteranInfo(drawText, adjustY, data);
  drawBuddyStatementBody(drawText, drawWrappedText, adjustY, data);

  // Check if we need a second page
  if (y < 200) {
    const _page2 = pdfDoc.addPage([612, 792]);
    y = height - 50;
  }

  drawBuddyStatementCertification(
    drawText,
    drawWrappedText,
    drawLine,
    adjustY,
    data,
  );

  return pdfDoc.save();
}

/**
 * Fill VA Form 21-4138 (Statement in Support of Claim) with actual field mappings
 */
function fill21_4138_IdentityInfo(setTextField, fieldMap, data) {
  const nameParts = (data.veteranName || data.name || "").split(" ");
  const ssn = parseSSNParts(data.ssn || data.veteranSSN);
  const dob = parseDOBParts(data.dob || data.veteranDOB);

  setTextField(fieldMap.firstName, nameParts[0]);
  setTextField(
    fieldMap.middleInitial,
    nameParts.length > 2 ? nameParts[1]?.[0] : "",
  );
  setTextField(fieldMap.lastName, nameParts[nameParts.length - 1]);
  setTextField(fieldMap.ssn1, ssn.first);
  setTextField(fieldMap.ssn2, ssn.middle);
  setTextField(fieldMap.ssn3, ssn.last);
  setTextField(fieldMap.vaFileNumber, data.vaFileNumber || "");
  setTextField(fieldMap.dobMonth, dob.month);
  setTextField(fieldMap.dobDay, dob.day);
  setTextField(fieldMap.dobYear, dob.year);
  setTextField(fieldMap.serviceNumber, data.serviceNumber || "");
}

function fill21_4138_ContactInfo(setTextField, fieldMap, data) {
  const phone = parsePhoneParts(data.phone || data.veteranPhone);
  const zipParts = parseZipParts(data.zip || data.veteranZip);

  setTextField(fieldMap.street, data.street || data.veteranStreet || "");
  setTextField(fieldMap.apt, data.apt || data.veteranApt || "");
  setTextField(fieldMap.city, data.city || data.veteranCity || "");
  setTextField(fieldMap.state, data.state || data.veteranState || "");
  setTextField(fieldMap.country, data.country || "USA");
  setTextField(fieldMap.zip5, zipParts.five);
  setTextField(fieldMap.zip4, zipParts.four);
  setTextField(fieldMap.phone1, phone.area);
  setTextField(fieldMap.phone2, phone.prefix);
  setTextField(fieldMap.phone3, phone.line);
  setTextField(fieldMap.email, data.email || data.veteranEmail || "");
}

function build21_4138_Remarks(data) {
  let remarks = "";
  if (data.conditionName) remarks += `CONDITION: ${data.conditionName}\n\n`;
  if (data.serviceConnection)
    remarks += `SERVICE CONNECTION:\n${data.serviceConnection}\n\n`;
  if (data.currentSymptoms)
    remarks += `CURRENT SYMPTOMS:\n${data.currentSymptoms}\n\n`;
  if (data.dailyImpact) remarks += `DAILY IMPACT:\n${data.dailyImpact}\n\n`;
  if (data.workImpact) remarks += `WORK IMPACT:\n${data.workImpact}\n\n`;
  if (data.treatmentHistory)
    remarks += `TREATMENT HISTORY:\n${data.treatmentHistory}\n\n`;
  if (data.additionalInfo)
    remarks += `ADDITIONAL INFORMATION:\n${data.additionalInfo}\n`;
  if (data.remarks) remarks = data.remarks;
  return remarks.trim();
}

export async function fillForm21_4138(data) {
  const pdfBytes = await fetchPdfForm("21-4138");
  const fieldMap = VA_FORM_FIELDS["21-4138"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);

      fill21_4138_IdentityInfo(setTextField, fieldMap, data);
      fill21_4138_ContactInfo(setTextField, fieldMap, data);

      setTextField(fieldMap.remarks, build21_4138_Remarks(data));
      setTextField(fieldMap.remarksPage2, ""); // Page 2 continuation if needed

      // Signature date
      const todayParts = getTodayParts();
      setTextField(fieldMap.dateMonth, todayParts.month);
      setTextField(fieldMap.dateDay, todayParts.day);
      setTextField(fieldMap.dateYear, todayParts.year);

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 21-4138:", error);
    }
  }

  // Fallback: Create formatted PDF
  return createPersonalStatementPdf(data);
}

function drawPersonalStatementHeader(drawText, adjustY, data) {
  drawText("STATEMENT IN SUPPORT OF CLAIM", { bold: true, size: 14 });
  drawText("(For use with VA Form 21-4138)", { size: 10 });
  adjustY(-15);

  drawText("CLAIMANT INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(`Condition: ${data.conditionName || ""}`);
  drawText(`Claim Type: ${data.claimType || ""}`);
  adjustY(-10);
}

function drawPersonalStatementBody(drawText, drawWrappedText, adjustY, data) {
  if (data.onsetDate || data.inServiceEvent) {
    drawText("IN-SERVICE EVENT/INJURY", { bold: true });
    if (data.onsetDate) {
      drawText(`Onset: ${data.onsetDate}`);
    }
    if (data.inServiceEvent) {
      drawWrappedText(data.inServiceEvent);
    }
    adjustY(-10);
  }

  if (data.symptoms) {
    drawText("CURRENT SYMPTOMS", { bold: true });
    drawWrappedText(data.symptoms);
    adjustY(-10);
  }

  if (data.workImpact) {
    drawText("IMPACT ON EMPLOYMENT", { bold: true });
    drawWrappedText(data.workImpact);
    adjustY(-10);
  }

  if (data.dailyImpact) {
    drawText("IMPACT ON DAILY ACTIVITIES", { bold: true });
    drawWrappedText(data.dailyImpact);
    adjustY(-10);
  }
}

function drawPersonalStatementSignature(
  drawText,
  drawWrappedText,
  adjustY,
  data,
) {
  adjustY(-20);
  drawText("CERTIFICATION", { bold: true });
  drawWrappedText(
    "I certify that the statements herein are true and correct to the best of my knowledge.",
  );
  adjustY(-20);
  drawText("Signature: _______________________________________");
  drawText(`Printed Name: ${data.veteranName || ""}`);
  drawText(`Date: ${new Date().toLocaleDateString()}`);
}

/**
 * Create personal statement PDF (fallback)
 */
async function createPersonalStatementPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentPage = pdfDoc.addPage([612, 792]);
  const { _width, height } = currentPage.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = makePaginatedDrawText(
    pdfDoc,
    font,
    fontBold,
    height,
    () => currentPage,
    (p) => {
      currentPage = p;
    },
    () => y,
    (v) => {
      y = v;
    },
  );
  const drawWrappedText = (text, maxWidth = 500) => {
    wrapTextToLines(font, text, 11, maxWidth).forEach((line) =>
      drawText(line),
    );
  };

  drawPersonalStatementHeader(drawText, adjustY, data);
  drawPersonalStatementBody(drawText, drawWrappedText, adjustY, data);
  drawPersonalStatementSignature(drawText, drawWrappedText, adjustY, data);

  return pdfDoc.save();
}

/**
 * Fill VA Form 21-0781 (PTSD Stressor Statement) with actual field mappings
 */
function parse21_0781_Name(data) {
  const nameParts = (data.veteranName || data.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const middleInitial = nameParts.length > 2 ? nameParts[1].charAt(0) : "";
  const lastName =
    nameParts.length > 2
      ? nameParts.slice(2).join(" ")
      : nameParts[1] || "";
  return { firstName, middleInitial, lastName };
}

function fill21_0781_VeteranInfo(setTextField, fieldMap, data) {
  const { firstName, middleInitial, lastName } = parse21_0781_Name(data);
  const ssn = parseSSNParts(data.ssn || data.veteranSSN);
  const phone = parsePhoneParts(data.phone || data.veteranPhone);
  const dob = parseDOBParts(data.dob || data.veteranDOB);

  setTextField(fieldMap.veteranFirstName, firstName);
  setTextField(fieldMap.veteranMiddleInitial, middleInitial);
  setTextField(fieldMap.veteranLastName, lastName);
  setTextField(fieldMap.vaFileNumber, data.vaFileNumber);
  setTextField(fieldMap.serviceNumber, data.serviceNumber);
  setTextField(fieldMap.ssn1, ssn.first);
  setTextField(fieldMap.ssn2, ssn.middle);
  setTextField(fieldMap.ssn3, ssn.last);
  setTextField(fieldMap.dobMonth, dob.month);
  setTextField(fieldMap.dobDay, dob.day);
  setTextField(fieldMap.dobYear, dob.year);
  setTextField(fieldMap.phoneArea, phone.area);
  setTextField(fieldMap.phonePrefix, phone.prefix);
  setTextField(fieldMap.phoneLine, phone.line);
  setTextField(fieldMap.intlPhone, data.intlPhone);
  setTextField(fieldMap.email, data.email || data.veteranEmail);
}

function fill21_0781_StressorTypeCheckboxes(setCheckbox, fieldMap, data) {
  setCheckbox(
    fieldMap.combatTraumatic,
    data.stressorType === "combat" || data.combatTraumatic,
  );
  setCheckbox(
    fieldMap.personalTraumaticNonMST,
    data.stressorType === "personal_non_mst" ||
      data.personalTraumaticNonMST,
  );
  setCheckbox(
    fieldMap.personalTraumaticMST,
    data.stressorType === "personal_mst" || data.personalTraumaticMST,
  );
  setCheckbox(
    fieldMap.otherTraumatic,
    data.stressorType === "other" || data.otherTraumatic,
  );
}

function fill21_0781_StressorEvents(setTextField, fieldMap, data) {
  // Stressor events - support both single incident and multiple incidents
  // For single incident data format
  if (
    data.incidentDescription ||
    data.incidentLocation ||
    data.incidentDate
  ) {
    setTextField(fieldMap.stressor1Description, data.incidentDescription);
    setTextField(fieldMap.stressor1Location, data.incidentLocation);
    setTextField(fieldMap.stressor1Dates, data.incidentDate);
  }

  // For multiple stressor format (stressors array)
  if (data.stressors && Array.isArray(data.stressors)) {
    if (data.stressors[0]) {
      setTextField(
        fieldMap.stressor1Description,
        data.stressors[0].description,
      );
      setTextField(fieldMap.stressor1Location, data.stressors[0].location);
      setTextField(fieldMap.stressor1Dates, data.stressors[0].dates);
    }
    if (data.stressors[1]) {
      setTextField(
        fieldMap.stressor2Description,
        data.stressors[1].description,
      );
      setTextField(fieldMap.stressor2Location, data.stressors[1].location);
      setTextField(fieldMap.stressor2Dates, data.stressors[1].dates);
    }
    if (data.stressors[2]) {
      setTextField(
        fieldMap.stressor3Description,
        data.stressors[2].description,
      );
      setTextField(fieldMap.stressor3Location, data.stressors[2].location);
      setTextField(fieldMap.stressor3Dates, data.stressors[2].dates);
    }
  }
}

function fill21_0781_BehavioralInfo(setTextField, setCheckbox, fieldMap, data) {
  setCheckbox(
    fieldMap.increasedHealthcareVisits,
    data.increasedHealthcareVisits,
  );
  setCheckbox(fieldMap.requestedDutyChange, data.requestedDutyChange);
  setCheckbox(fieldMap.changesInLeave, data.changesInLeave);
  setCheckbox(fieldMap.performanceChanges, data.performanceChanges);
  setCheckbox(
    fieldMap.depressionPanicAnxiety,
    data.depressionPanicAnxiety ||
      data.behavioralChanges?.includes("depression"),
  );
  setCheckbox(
    fieldMap.prescriptionMedsChanges,
    data.prescriptionMedsChanges,
  );
  setCheckbox(fieldMap.otcMedsChanges, data.otcMedsChanges);
  setCheckbox(fieldMap.substanceUseChanges, data.substanceUseChanges);
  setCheckbox(fieldMap.disciplinaryLegal, data.disciplinaryLegal);
  setCheckbox(fieldMap.eatingHabitChanges, data.eatingHabitChanges);
  setCheckbox(fieldMap.pregnancyTests, data.pregnancyTests);
  setCheckbox(fieldMap.stiTests, data.stiTests);
  setCheckbox(fieldMap.economicSocialChanges, data.economicSocialChanges);
  setCheckbox(fieldMap.relationshipChanges, data.relationshipChanges);

  setTextField(
    fieldMap.additionalBehaviorInfo0,
    data.ptsdSymptoms || data.behavioralChangesDetail,
  );
  setTextField(
    fieldMap.listAdditionalBehavioralChanges,
    data.additionalBehavioralChanges,
  );
}

function fill21_0781_ReportsInfo(setTextField, setCheckbox, fieldMap, data) {
  setCheckbox(fieldMap.rapeCrisisCenter, data.rapeCrisisCenter);
  setCheckbox(fieldMap.counselingFacility, data.counselingFacility);
  setCheckbox(
    fieldMap.familyOrRoomates,
    data.familyOrRoomates || data.toldFamily,
  );
  setCheckbox(fieldMap.facultyMember, data.facultyMember);
  setCheckbox(fieldMap.civilianPolice, data.civilianPolice);
  setCheckbox(fieldMap.medicalReports, data.medicalReports);
  setCheckbox(fieldMap.chaplainClergy, data.chaplainClergy);
  setCheckbox(
    fieldMap.fellowServiceMembers,
    data.fellowServiceMembers || data.toldServiceMembers,
  );
  setCheckbox(fieldMap.personalDiaries, data.personalDiaries);
  setTextField(fieldMap.policeReportLocation, data.policeReportLocation);
  setTextField(fieldMap.otherReportText, data.otherReportText);
}

function fill21_0781_TreatmentInfo(setTextField, setCheckbox, fieldMap, data) {
  setCheckbox(fieldMap.privateProvider, data.privateProvider);
  setCheckbox(fieldMap.vaVetCenter, data.vaVetCenter);
  setCheckbox(fieldMap.communityCarePaidByVA, data.communityCarePaidByVA);
  setCheckbox(fieldMap.vaMedicalCenter, data.vaMedicalCenter);
  setCheckbox(fieldMap.dodTreatmentFacilities, data.dodTreatmentFacilities);

  setTextField(
    fieldMap.treatmentFacility1,
    data.treatmentFacility1 || data.treatmentLocation,
  );
  setTextField(fieldMap.treatmentFacility2, data.treatmentFacility2);
  setTextField(fieldMap.treatmentFacility3, data.treatmentFacility3);
}

function fill21_0781_RemarksAndConsent(setTextField, setCheckbox, fieldMap, data) {
  setTextField(fieldMap.remarks, data.remarks || data.additionalInfo);

  setCheckbox(fieldMap.consentVBA, data.consentVBA !== false); // Default to consent
  setCheckbox(fieldMap.noConsentVBA, data.noConsentVBA);
  setCheckbox(fieldMap.revokeConsent, data.revokeConsent);
  setCheckbox(fieldMap.notEnrolledVHA, data.notEnrolledVHA);
}

export async function fillForm21_0781(data) {
  const pdfBytes = await fetchPdfForm("21-0781");
  const fieldMap = VA_FORM_FIELDS["21-0781"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);
      const setCheckbox = (fieldName, checked) =>
        setPdfCheckbox(form, fieldName, checked);

      fill21_0781_VeteranInfo(setTextField, fieldMap, data);
      fill21_0781_StressorTypeCheckboxes(setCheckbox, fieldMap, data);
      fill21_0781_StressorEvents(setTextField, fieldMap, data);
      fill21_0781_BehavioralInfo(setTextField, setCheckbox, fieldMap, data);
      fill21_0781_ReportsInfo(setTextField, setCheckbox, fieldMap, data);
      fill21_0781_TreatmentInfo(setTextField, setCheckbox, fieldMap, data);
      fill21_0781_RemarksAndConsent(setTextField, setCheckbox, fieldMap, data);

      // Today's date for signature
      const todayParts = getTodayParts();
      setTextField(fieldMap.signDateMonth, todayParts.month);
      setTextField(fieldMap.signDateDay, todayParts.day);
      setTextField(fieldMap.signDateYear, todayParts.year);

      // Flatten to make form read-only if desired
      // form.flatten();

      return pdfDoc.save();
    } catch (error) {
      console.error("Error filling 21-0781:", error);
      // Fall back to generated PDF
      return createPTSDStatementPdfFallback(data);
    }
  }

  // Fallback if form not available
  return createPTSDStatementPdfFallback(data);
}

/**
 * Fallback PDF generation for PTSD Statement when official form unavailable
 */
async function createPTSDStatementPdfFallback(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentPage = pdfDoc.addPage([612, 792]);
  const { height } = currentPage.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = makePaginatedDrawText(
    pdfDoc,
    font,
    fontBold,
    height,
    () => currentPage,
    (p) => {
      currentPage = p;
    },
    () => y,
    (v) => {
      y = v;
    },
  );
  const drawWrappedText = (text, maxWidth = 500) => {
    wrapTextToLines(font, text, 11, maxWidth).forEach((line) =>
      drawText(line),
    );
  };

  drawText("STATEMENT IN SUPPORT OF CLAIM FOR PTSD", { bold: true, size: 14 });
  drawText("(Reference for VA Form 21-0781)", { size: 10 });
  adjustY(-15);

  drawText("VETERAN INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(`SSN Last 4: ${data.ssnLast4 || "XXX-XX-____"}`);
  adjustY(-10);

  drawText("STRESSOR INCIDENT DETAILS", { bold: true });
  if (data.incidentDate) drawText(`Date: ${data.incidentDate}`);
  if (data.incidentLocation) drawText(`Location: ${data.incidentLocation}`);
  if (data.unitAssignment) drawText(`Unit: ${data.unitAssignment}`);
  adjustY(-5);

  if (data.incidentDescription) {
    drawText("Description:", { bold: true, size: 10 });
    drawWrappedText(data.incidentDescription);
    adjustY(-10);
  }

  if (data.witnesses) {
    drawText("WITNESSES", { bold: true });
    drawWrappedText(data.witnesses);
    adjustY(-10);
  }

  if (data.ptsdSymptoms) {
    drawText("CURRENT SYMPTOMS", { bold: true });
    drawWrappedText(data.ptsdSymptoms);
    adjustY(-10);
  }

  adjustY(-20);
  drawText("Signature: _______________________________________");
  drawText(`Date: ${new Date().toLocaleDateString()}`);

  return pdfDoc.save();
}

/**
 * Fill VA Form 21-0966 (Intent to File) with actual field mappings
 */
function fill21_0966_VeteranInfo(setTextField, fieldMap, data) {
  const nameParts = (data.veteranName || data.name || "").split(" ");
  const phone = parsePhoneParts(data.phone || data.veteranPhone);
  const ssn = parseSSNParts(data.ssn || data.veteranSSN);
  const dob = parseDOBParts(data.dob || data.veteranDOB);
  const zipParts = parseZipParts(data.zip || data.veteranZip);

  setTextField(fieldMap.veteranFirstName, nameParts[0]);
  setTextField(
    fieldMap.veteranMiddleInitial,
    nameParts.length > 2 ? nameParts[1]?.[0] : "",
  );
  setTextField(fieldMap.veteranLastName, nameParts[nameParts.length - 1]);
  setTextField(fieldMap.veteranSSN1, ssn.first);
  setTextField(fieldMap.veteranSSN2, ssn.middle);
  setTextField(fieldMap.veteranSSN3, ssn.last);
  setTextField(fieldMap.veteranDOBMonth, dob.month);
  setTextField(fieldMap.veteranDOBDay, dob.day);
  setTextField(fieldMap.veteranDOBYear, dob.year);
  setTextField(fieldMap.vaFileNumber, data.vaFileNumber || "");
  setTextField(fieldMap.serviceNumber, data.serviceNumber || "");
  setTextField(fieldMap.street, data.street || data.veteranStreet || "");
  setTextField(fieldMap.apt, data.apt || "");
  setTextField(fieldMap.city, data.city || data.veteranCity || "");
  setTextField(fieldMap.state, data.state || data.veteranState || "");
  setTextField(fieldMap.country, data.country || "USA");
  setTextField(fieldMap.zip5, zipParts.five);
  setTextField(fieldMap.zip4, zipParts.four);
  setTextField(fieldMap.phone1, phone.area);
  setTextField(fieldMap.phone2, phone.prefix);
  setTextField(fieldMap.phone3, phone.line);
  setTextField(fieldMap.email, data.email || data.veteranEmail || "");
}

function fill21_0966_BenefitCheckboxes(setCheckbox, fieldMap, data) {
  const benefits = data.benefitTypes || [data.benefitType] || [
      "compensation",
    ];
  const benefitStr = benefits.join(",").toLowerCase();
  if (benefitStr.includes("compensation"))
    setCheckbox(fieldMap.compensationCheckbox, true);
  if (benefitStr.includes("pension"))
    setCheckbox(fieldMap.pensionCheckbox, true);
  if (benefitStr.includes("dic") || benefitStr.includes("survivor"))
    setCheckbox(fieldMap.dicCheckbox, true);
}

export async function fillForm21_0966(data) {
  const pdfBytes = await fetchPdfForm("21-0966");
  const fieldMap = VA_FORM_FIELDS["21-0966"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);
      const setCheckbox = (fieldName, checked) =>
        setPdfCheckbox(form, fieldName, checked);

      fill21_0966_VeteranInfo(setTextField, fieldMap, data);
      fill21_0966_BenefitCheckboxes(setCheckbox, fieldMap, data);

      // Signature date
      const todayParts = getTodayParts();
      setTextField(fieldMap.dateMonth, todayParts.month);
      setTextField(fieldMap.dateDay, todayParts.day);
      setTextField(fieldMap.dateYear, todayParts.year);

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 21-0966:", error);
    }
  }

  // Fallback
  return createIntentToFilePdf(data);
}

async function createIntentToFilePdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = makeFlatDrawText(
    font,
    fontBold,
    page,
    () => y,
    (v) => {
      y = v;
    },
  );

  drawText("INTENT TO FILE WORKSHEET", { bold: true, size: 14 });
  drawText("(Reference for VA Form 21-0966)", { size: 10 });
  adjustY(-15);

  drawText(
    "This worksheet contains the information needed to file your Intent to File.",
    { size: 10 },
  );
  drawText("Submit online at: va.gov/intent-to-file", { size: 10 });
  adjustY(-15);

  drawText("CLAIMANT INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(`Date of Birth: ${data.dob || ""}`);
  drawText(`SSN: ${data.ssn || "XXX-XX-____"}`);
  drawText(`Phone: ${data.phone || ""}`);
  drawText(`Email: ${data.email || ""}`);
  adjustY(-10);

  drawText("BENEFIT TYPE", { bold: true });
  const benefits = Array.isArray(data.benefitTypes)
    ? data.benefitTypes.join(", ")
    : data.benefitType || "";
  drawText(benefits || "Compensation");
  adjustY(-10);

  drawText(
    "IMPORTANT: Submit your full claim within 1 year to preserve this effective date.",
    { bold: true, size: 10 },
  );

  adjustY(-30);
  drawText(`Date: ${new Date().toLocaleDateString()}`);

  return pdfDoc.save();
}

/**
 * Fill VA Forms 21-4142/4142a (Medical Release) with actual field mappings
 */
function fill21_4142_VeteranInfo(setTextField, fieldMap, data) {
  const nameParts = (data.veteranName || data.name || "").split(" ");
  const ssn = parseSSNParts(data.ssn || data.veteranSSN);
  const dob = parseDOBParts(data.dob || data.veteranDOB);

  setTextField(fieldMap.veteranFirstName, nameParts[0]);
  setTextField(
    fieldMap.veteranMiddleInitial,
    nameParts.length > 2 ? nameParts[1]?.[0] : "",
  );
  setTextField(fieldMap.veteranLastName, nameParts[nameParts.length - 1]);
  setTextField(fieldMap.veteranSSN1, ssn.first);
  setTextField(fieldMap.veteranSSN2, ssn.middle);
  setTextField(fieldMap.veteranSSN3, ssn.last);
  setTextField(fieldMap.vaFileNumber, data.vaFileNumber || "");
  setTextField(fieldMap.dobMonth, dob.month);
  setTextField(fieldMap.dobDay, dob.day);
  setTextField(fieldMap.dobYear, dob.year);
  setTextField(fieldMap.serviceNumber, data.serviceNumber || "");
  setTextField(fieldMap.street, data.street || data.veteranStreet || "");
}

export async function fillForm21_4142(data) {
  const pdfBytes = await fetchPdfForm("21-4142");
  const fieldMap = VA_FORM_FIELDS["21-4142"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);

      fill21_4142_VeteranInfo(setTextField, fieldMap, data);

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 21-4142:", error);
    }
  }

  // Fallback
  return createMedicalReleasePdf(data);
}

async function createMedicalReleasePdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = makeFlatDrawText(
    font,
    fontBold,
    page,
    () => y,
    (v) => {
      y = v;
    },
  );

  drawText("AUTHORIZATION TO DISCLOSE INFORMATION", { bold: true, size: 14 });
  drawText("(Reference for VA Forms 21-4142 & 21-4142a)", { size: 10 });
  adjustY(-15);

  drawText("VETERAN INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(`DOB: ${data.dob || ""}`);
  drawText(`VA File #: ${data.vaFileNumber || ""}`);
  drawText(`Phone: ${data.phone || ""}`);
  adjustY(-10);

  drawText("HEALTHCARE PROVIDER", { bold: true });
  drawText(`Provider: ${data.provider1Name || ""}`);
  drawText(`Address: ${data.provider1Address || ""}`);
  drawText(`Phone: ${data.provider1Phone || ""}`);
  drawText(`Dates: ${data.provider1Dates || ""}`);
  drawText(`Conditions: ${data.provider1Conditions || ""}`);
  adjustY(-10);

  if (data.provider2Name) {
    drawText("ADDITIONAL PROVIDER", { bold: true });
    drawText(`Provider: ${data.provider2Name}`);
    drawText(`Address: ${data.provider2Address || ""}`);
    drawText(`Dates: ${data.provider2Dates || ""}`);
  }

  adjustY(-20);
  const expDate = new Date(
    Date.now() + 180 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString();
  drawText(`This authorization expires: ${expDate}`, { bold: true });
  adjustY(-20);
  drawText("Signature: _______________________________________");
  drawText(`Date: ${new Date().toLocaleDateString()}`);

  return pdfDoc.save();
}

/**
 * Fill VA Form 20-10207 (Priority Processing) with actual field mappings
 */
function fill20_10207_VeteranInfo(setTextField, fieldMap, data) {
  const nameParts = (data.veteranName || data.name || "").split(" ");
  const phone = parsePhoneParts(data.phone || data.veteranPhone);
  const ssn = parseSSNParts(data.ssn || data.veteranSSN);
  const dob = parseDOBParts(data.dob || data.veteranDOB);
  const zipParts = parseZipParts(data.zip || data.veteranZip);

  setTextField(fieldMap.veteranFirstName, nameParts[0]);
  setTextField(
    fieldMap.veteranMiddleInitial,
    nameParts.length > 2 ? nameParts[1]?.[0] : "",
  );
  setTextField(fieldMap.veteranLastName, nameParts[nameParts.length - 1]);
  setTextField(fieldMap.veteranSSN1, ssn.first);
  setTextField(fieldMap.veteranSSN2, ssn.middle);
  setTextField(fieldMap.veteranSSN3, ssn.last);
  setTextField(fieldMap.dobMonth, dob.month);
  setTextField(fieldMap.dobDay, dob.day);
  setTextField(fieldMap.dobYear, dob.year);
  setTextField(fieldMap.vaFileNumber, data.vaFileNumber || "");
  setTextField(fieldMap.street, data.street || data.veteranStreet || "");
  setTextField(fieldMap.apt, data.apt || "");
  setTextField(fieldMap.city, data.city || data.veteranCity || "");
  setTextField(fieldMap.state, data.state || data.veteranState || "");
  setTextField(fieldMap.country, data.country || "USA");
  setTextField(fieldMap.zip5, zipParts.five);
  setTextField(fieldMap.zip4, zipParts.four);
  setTextField(fieldMap.phone1, phone.area);
  setTextField(fieldMap.phone2, phone.prefix);
  setTextField(fieldMap.phone3, phone.line);
  setTextField(fieldMap.email, data.email || data.veteranEmail || "");
}

function fill20_10207_PriorityCheckboxes(setCheckbox, fieldMap, data) {
  const reasons = data.priorityReasons || [];
  const reasonStr = reasons.join(",").toLowerCase();
  if (reasonStr.includes("illness") || reasonStr.includes("terminal"))
    setCheckbox(fieldMap.advancedIllness, true);
  if (reasonStr.includes("financial") && !reasonStr.includes("extreme"))
    setCheckbox(fieldMap.financialHardship, true);
  if (reasonStr.includes("als") || reasonStr.includes("amyotrophic"))
    setCheckbox(fieldMap.alsDisease, true);
  if (reasonStr.includes("85") || reasonStr.includes("age"))
    setCheckbox(fieldMap.over85, true);
  if (reasonStr.includes("homeless"))
    setCheckbox(fieldMap.homelessAtRisk, true);
  if (reasonStr.includes("extreme"))
    setCheckbox(fieldMap.extremeFinancial, true);
}

export async function fillForm20_10207(data) {
  const pdfBytes = await fetchPdfForm("20-10207");
  const fieldMap = VA_FORM_FIELDS["20-10207"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);
      const setCheckbox = (fieldName, checked) =>
        setPdfCheckbox(form, fieldName, checked);

      fill20_10207_VeteranInfo(setTextField, fieldMap, data);
      fill20_10207_PriorityCheckboxes(setCheckbox, fieldMap, data);

      // Signature date
      const todayParts = getTodayParts();
      setTextField(fieldMap.dateMonth, todayParts.month);
      setTextField(fieldMap.dateDay, todayParts.day);
      setTextField(fieldMap.dateYear, todayParts.year);

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 20-10207:", error);
    }
  }

  // Fallback
  return createPriorityProcessingPdf(data);
}

async function createPriorityProcessingPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = makePaginatedDrawText(
    pdfDoc,
    font,
    fontBold,
    height,
    () => page,
    (p) => {
      page = p;
    },
    () => y,
    (v) => {
      y = v;
    },
  );
  const drawWrappedText = (text, maxWidth = 500) => {
    wrapTextToLines(font, text, 11, maxWidth).forEach((line) =>
      drawText(line),
    );
  };

  drawText("REQUEST FOR PRIORITY PROCESSING", { bold: true, size: 14 });
  drawText("(Reference for VA Form 20-10207)", { size: 10 });
  adjustY(-15);

  drawText("CLAIMANT INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(`DOB: ${data.dob || ""}`);
  drawText(`VA File #: ${data.vaFileNumber || ""}`);
  drawText(`Phone: ${data.phone || ""}`);
  adjustY(-10);

  drawText("PENDING CLAIM", { bold: true });
  drawText(`Claim Type: ${data.claimType || ""}`);
  drawText(`Date Filed: ${data.claimDate || ""}`);
  adjustY(-10);

  if (data.priorityReasons && data.priorityReasons.length > 0) {
    drawText("QUALIFYING CIRCUMSTANCES", { bold: true });
    for (const reason of data.priorityReasons) {
      drawText(`• ${reason}`);
    }
    adjustY(-10);
  }

  if (data.hardshipExplanation) {
    drawText("HARDSHIP EXPLANATION", { bold: true });
    drawWrappedText(data.hardshipExplanation);
    adjustY(-10);
  }

  adjustY(-20);
  drawText("Signature: _______________________________________");
  drawText(`Date: ${new Date().toLocaleDateString()}`);

  return pdfDoc.save();
}

/**
 * Fill VA Form 21-22 (VSO Appointment) with actual field mappings
 */
function fill21_22_VeteranInfo(setTextField, fieldMap, data) {
  const nameParts = (data.veteranName || "").split(" ").filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts[nameParts.length - 1] || "";
  const middleInitial = nameParts.length > 2 ? nameParts[1]?.[0] : "";

  const ssn = parseSSNParts(data.ssn || data.veteranSSN);

  const dobRaw = data.dob || data.veteranDOB || "";
  const dobParts = dobRaw.split(/[/-]/);
  const dob = {
    month: dobParts[0] || "",
    day: dobParts[1] || "",
    year: dobParts[2] || "",
  };

  setTextField(fieldMap.veteranFirstName, firstName);
  setTextField(fieldMap.veteranMiddleInitial, middleInitial);
  setTextField(fieldMap.veteranLastName, lastName);
  setTextField(fieldMap.veteranSSN1, ssn.first);
  setTextField(fieldMap.veteranSSN2, ssn.middle);
  setTextField(fieldMap.veteranSSN3, ssn.last);
  setTextField(fieldMap.veteranDOBMonth, dob.month);
  setTextField(fieldMap.veteranDOBDay, dob.day);
  setTextField(fieldMap.veteranDOBYear, dob.year);
  setTextField(fieldMap.vaFileNumber, data.vaFileNumber || "");
  setTextField(fieldMap.serviceNumber, data.serviceNumber || "");
  setTextField(fieldMap.insuranceNumber, data.insuranceNumber || "");
  setTextField(fieldMap.veteranPhone, data.veteranPhone || data.phone || "");
  setTextField(
    fieldMap.veteranEmail,
    data.veteranEmail || data.email || "",
  );
}

function fill21_22_ClaimantInfo(setTextField, fieldMap, data) {
  if (!(data.claimantName || data.claimantFirstName)) return;

  const claimantParts = (data.claimantName || "").split(" ").filter(Boolean);
  setTextField(
    fieldMap.claimantFirstName,
    data.claimantFirstName || claimantParts[0] || "",
  );
  setTextField(
    fieldMap.claimantMiddleInitial,
    data.claimantMiddleInitial ||
      (claimantParts.length > 2 ? claimantParts[1]?.[0] : ""),
  );
  setTextField(
    fieldMap.claimantLastName,
    data.claimantLastName || claimantParts[claimantParts.length - 1] || "",
  );
  setTextField(
    fieldMap.claimantRelationship,
    data.claimantRelationship || "",
  );
  setTextField(fieldMap.claimantStreet, data.claimantStreet || "");
  setTextField(fieldMap.claimantApt, data.claimantApt || "");
  setTextField(fieldMap.claimantCity, data.claimantCity || "");
  setTextField(fieldMap.claimantState, data.claimantState || "");
  setTextField(fieldMap.claimantCountry, data.claimantCountry || "USA");
  const claimantZip = (data.claimantZip || "").replace(/\D/g, "");
  setTextField(fieldMap.claimantZip5, claimantZip.substring(0, 5));
  setTextField(fieldMap.claimantZip4, claimantZip.substring(5, 9));
  setTextField(fieldMap.claimantPhone, data.claimantPhone || "");
  setTextField(fieldMap.claimantEmail, data.claimantEmail || "");
}

function fill21_22_OrganizationInfo(setTextField, fieldMap, data, today) {
  setTextField(
    fieldMap.organizationName,
    data.vsoName || data.organizationName || "",
  );
  setTextField(fieldMap.representativeName, data.representativeName || "");
  setTextField(
    fieldMap.representativeTitle,
    data.representativeTitle || "",
  );
  setTextField(
    fieldMap.representativeEmail,
    data.representativeEmail || "",
  );

  setTextField(
    fieldMap.organizationStreet,
    data.organizationStreet || data.vsoStreet || "",
  );
  setTextField(fieldMap.organizationApt, data.organizationApt || "");
  setTextField(
    fieldMap.organizationCity,
    data.organizationCity || data.vsoCity || "",
  );
  setTextField(
    fieldMap.organizationState,
    data.organizationState || data.vsoState || "",
  );
  setTextField(
    fieldMap.organizationCountry,
    data.organizationCountry || "USA",
  );
  const orgZip = (data.organizationZip || data.vsoZip || "").replace(
    /\D/g,
    "",
  );
  setTextField(fieldMap.organizationZip5, orgZip.substring(0, 5));
  setTextField(fieldMap.organizationZip4, orgZip.substring(5, 9));

  setTextField(fieldMap.appointmentDate, data.appointmentDate || today);
}

function fill21_22_AuthorizationCheckboxes(setCheckbox, fieldMap, data) {
  setCheckbox(fieldMap.vrAndEFile, data.vrAndEFile || data.authVRE);
  setCheckbox(fieldMap.eduFile, data.eduFile || data.authEducation);
  setCheckbox(fieldMap.lgFile, data.lgFile || data.authLoanGuaranty);
  setCheckbox(
    fieldMap.insuranceFile,
    data.insuranceFile || data.authInsurance,
  );

  setCheckbox(
    fieldMap.authorizeDisclosure,
    data.authorizeDisclosure !== false,
  );
  setCheckbox(fieldMap.drugAbuse, data.discloseDrugAbuse);
  setCheckbox(fieldMap.alcoholism, data.discloseAlcoholism);
  setCheckbox(fieldMap.hivInfection, data.discloseHIV);
  setCheckbox(fieldMap.sickleCellAnemia, data.discloseSickleCell);
  setCheckbox(fieldMap.authorizeChange, data.authorizeChange);
}

export async function fillForm21_22(data) {
  const pdfBytes = await fetchPdfForm("21-22");
  const fieldMap = VA_FORM_FIELDS["21-22"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();
      const setTextField = (fieldName, value) =>
        setPdfTextField(form, fieldName, value);
      const setCheckbox = (fieldName, checked) =>
        setPdfCheckbox(form, fieldName, checked);

      const today = new Date().toLocaleDateString("en-US");

      fill21_22_VeteranInfo(setTextField, fieldMap, data);
      fill21_22_ClaimantInfo(setTextField, fieldMap, data);
      fill21_22_OrganizationInfo(setTextField, fieldMap, data, today);
      fill21_22_AuthorizationCheckboxes(setCheckbox, fieldMap, data);

      // Signature dates
      setTextField(fieldMap.claimantSignDate, data.signDate || today);

      // Page 2 SSN
      const ssn = parseSSNParts(data.ssn || data.veteranSSN);
      setTextField(fieldMap.page2SSN1, ssn.first);
      setTextField(fieldMap.page2SSN2, ssn.middle);
      setTextField(fieldMap.page2SSN3, ssn.last);

      // Flatten form to prevent further editing (optional)
      form.flatten();

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 21-22:", error);
    }
  }

  // Fallback - create simple PDF
  return createVSOAppointmentPdf(data);
}

async function createVSOAppointmentPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 50;
  const adjustY = (delta) => {
    y += delta;
  };

  const drawText = makePaginatedDrawText(
    pdfDoc,
    font,
    fontBold,
    height,
    () => page,
    (p) => {
      page = p;
    },
    () => y,
    (v) => {
      y = v;
    },
  );

  drawText("APPOINTMENT OF VETERANS SERVICE ORGANIZATION", {
    bold: true,
    size: 14,
  });
  drawText("AS CLAIMANT'S REPRESENTATIVE", { bold: true, size: 12 });
  drawText("(Reference for VA Form 21-22)", { size: 10 });
  adjustY(-15);

  drawText("VETERAN INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(
    `SSN: XXX-XX-${(data.ssn || data.veteranSSN || "").slice(-4) || "XXXX"}`,
  );
  drawText(`DOB: ${data.dob || data.veteranDOB || ""}`);
  drawText(`Phone: ${data.phone || data.veteranPhone || ""}`);
  drawText(`Email: ${data.email || data.veteranEmail || ""}`);
  adjustY(-10);

  drawText("SERVICE ORGANIZATION", { bold: true });
  drawText(`Organization: ${data.vsoName || data.organizationName || ""}`);
  drawText(`Representative: ${data.representativeName || ""}`);
  drawText(`Title: ${data.representativeTitle || ""}`);
  adjustY(-10);

  drawText("AUTHORIZATION SCOPE", { bold: true });
  if (data.authVRE) drawText("☑ Vocational Rehabilitation & Employment");
  if (data.authEducation) drawText("☑ Education");
  if (data.authLoanGuaranty) drawText("☑ Loan Guaranty");
  if (data.authInsurance) drawText("☑ Insurance");
  adjustY(-20);

  drawText("Signature: _______________________________________");
  drawText(`Date: ${new Date().toLocaleDateString()}`);

  return pdfDoc.save();
}

/**
 * Fill VA Form 21-22a (Individual Representative Appointment) with actual field mappings
 */
export async function fillForm21_22a(data) {
  const pdfBytes = await fetchPdfForm("21-22a");
  const fieldMap = VA_FORM_FIELDS["21-22a"];

  if (pdfBytes && fieldMap) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const form = pdfDoc.getForm();

      const setTextField = (fieldName, value) => {
        if (!value) return;
        try {
          const field = form.getTextField(fieldName);
          if (field) field.setText(String(value));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(`Field not found: ${fieldName}`);
        }
      };

      const setCheckbox = (fieldName, checked) => {
        try {
          const field = form.getCheckBox(fieldName);
          if (field && checked) field.check();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(`Checkbox not found: ${fieldName}`);
        }
      };

      // Parse veteran name
      const nameParts = (data.veteranName || "").split(" ").filter(Boolean);
      const firstName = nameParts[0] || "";
      const lastName = nameParts[nameParts.length - 1] || "";
      const middleInitial = nameParts.length > 2 ? nameParts[1]?.[0] : "";

      // Parse SSN
      const ssnRaw = (data.ssn || data.veteranSSN || "").replace(/\D/g, "");
      const ssn = {
        first: ssnRaw.substring(0, 3),
        middle: ssnRaw.substring(3, 5),
        last: ssnRaw.substring(5, 9),
      };

      // Parse DOB
      const dobRaw = data.dob || data.veteranDOB || "";
      const dobParts = dobRaw.split(/[/-]/);
      const dob = {
        month: dobParts[0] || "",
        day: dobParts[1] || "",
        year: dobParts[2] || "",
      };

      // Parse phone
      const phoneRaw = (data.phone || data.veteranPhone || "").replace(
        /\D/g,
        "",
      );
      const phone = {
        area: phoneRaw.substring(0, 3),
        prefix: phoneRaw.substring(3, 6),
        line: phoneRaw.substring(6, 10),
      };

      // Fill veteran information
      setTextField(fieldMap.veteranFirstName, firstName);
      setTextField(fieldMap.veteranMiddleInitial, middleInitial);
      setTextField(fieldMap.veteranLastName, lastName);
      setTextField(fieldMap.veteranSSN1, ssn.first);
      setTextField(fieldMap.veteranSSN2, ssn.middle);
      setTextField(fieldMap.veteranSSN3, ssn.last);
      setTextField(fieldMap.veteranDOBMonth, dob.month);
      setTextField(fieldMap.veteranDOBDay, dob.day);
      setTextField(fieldMap.veteranDOBYear, dob.year);
      setTextField(fieldMap.vaFileNumber, data.vaFileNumber || "");
      setTextField(fieldMap.serviceNumber, data.serviceNumber || "");
      setTextField(fieldMap.veteranPhone1, phone.area);
      setTextField(fieldMap.veteranPhone2, phone.prefix);
      setTextField(fieldMap.veteranPhone3, phone.line);
      setTextField(fieldMap.veteranIntlPhone, data.veteranIntlPhone || "");
      setTextField(
        fieldMap.veteranEmail,
        data.email || data.veteranEmail || "",
      );

      // Fill claimant information (if different from veteran)
      if (data.claimantName || data.claimantFirstName) {
        const claimantParts = (data.claimantName || "")
          .split(" ")
          .filter(Boolean);
        setTextField(
          fieldMap.claimantFirstName,
          data.claimantFirstName || claimantParts[0] || "",
        );
        setTextField(
          fieldMap.claimantMiddleInitial,
          data.claimantMiddleInitial ||
            (claimantParts.length > 2 ? claimantParts[1]?.[0] : ""),
        );
        setTextField(
          fieldMap.claimantLastName,
          data.claimantLastName ||
            claimantParts[claimantParts.length - 1] ||
            "",
        );
        setTextField(
          fieldMap.claimantRelationship,
          data.claimantRelationship || "",
        );

        const claimantDobParts = (data.claimantDOB || "").split(/[/-]/);
        setTextField(fieldMap.claimantDOBMonth, claimantDobParts[0] || "");
        setTextField(fieldMap.claimantDOBDay, claimantDobParts[1] || "");
        setTextField(fieldMap.claimantDOBYear, claimantDobParts[2] || "");

        setTextField(fieldMap.claimantStreet, data.claimantStreet || "");
        setTextField(fieldMap.claimantApt, data.claimantApt || "");
        setTextField(fieldMap.claimantCity, data.claimantCity || "");
        setTextField(fieldMap.claimantState, data.claimantState || "");
        setTextField(fieldMap.claimantCountry, data.claimantCountry || "USA");
        const claimantZip = (data.claimantZip || "").replace(/\D/g, "");
        setTextField(fieldMap.claimantZip5, claimantZip.substring(0, 5));
        setTextField(fieldMap.claimantZip4, claimantZip.substring(5, 9));

        const claimantPhoneRaw = (data.claimantPhone || "").replace(/\D/g, "");
        setTextField(fieldMap.claimantPhone1, claimantPhoneRaw.substring(0, 3));
        setTextField(fieldMap.claimantPhone2, claimantPhoneRaw.substring(3, 6));
        setTextField(
          fieldMap.claimantPhone3,
          claimantPhoneRaw.substring(6, 10),
        );
        setTextField(fieldMap.claimantEmail, data.claimantEmail || "");
      }

      // Fill representative information
      const repParts = (data.representativeName || "")
        .split(" ")
        .filter(Boolean);
      setTextField(
        fieldMap.representativeFirstName,
        data.repFirstName || repParts[0] || "",
      );
      setTextField(
        fieldMap.representativeMiddleInitial,
        data.repMiddleInitial || (repParts.length > 2 ? repParts[1]?.[0] : ""),
      );
      setTextField(
        fieldMap.representativeLastName,
        data.repLastName || repParts[repParts.length - 1] || "",
      );
      setTextField(
        fieldMap.representativeOrganization,
        data.repOrganization || data.firmName || "",
      );

      // Page 2 information
      setTextField(fieldMap.page2SSN1, ssn.first);
      setTextField(fieldMap.page2SSN2, ssn.middle);
      setTextField(fieldMap.page2SSN3, ssn.last);
      setTextField(fieldMap.firmName, data.firmName || "");
      setTextField(fieldMap.additionalReps, data.additionalReps || "");

      // Rep address
      setTextField(fieldMap.repStreet, data.repStreet || "");
      setTextField(fieldMap.repApt, data.repApt || "");
      setTextField(fieldMap.repCity, data.repCity || "");
      setTextField(fieldMap.repState, data.repState || "");
      setTextField(fieldMap.repCountry, data.repCountry || "USA");
      const repZip = (data.repZip || "").replace(/\D/g, "");
      setTextField(fieldMap.repZip5, repZip.substring(0, 5));
      setTextField(fieldMap.repZip4, repZip.substring(5, 9));

      const repPhoneRaw = (data.repPhone || "").replace(/\D/g, "");
      setTextField(fieldMap.repPhone1, repPhoneRaw.substring(0, 3));
      setTextField(fieldMap.repPhone2, repPhoneRaw.substring(3, 6));
      setTextField(fieldMap.repPhone3, repPhoneRaw.substring(6, 10));
      setTextField(fieldMap.repEmail, data.repEmail || "");

      // Authorization checkboxes
      setCheckbox(
        fieldMap.authorizeRecordAccess,
        data.authorizeRecordAccess !== false,
      );
      setCheckbox(
        fieldMap.authorizeActOnBehalf,
        data.authorizeActOnBehalf !== false,
      );
      setCheckbox(
        fieldMap.authorizeDisclosure1,
        data.authorizeDisclosure !== false,
      );
      setCheckbox(fieldMap.authorizeDisclosure2, data.authorizeDisclosure2);

      // Signature dates
      const today = new Date();
      const todayParts = {
        month: String(today.getMonth() + 1).padStart(2, "0"),
        day: String(today.getDate()).padStart(2, "0"),
        year: String(today.getFullYear()),
      };

      setTextField(
        fieldMap.claimantSignDateMonth,
        data.signDateMonth || todayParts.month,
      );
      setTextField(
        fieldMap.claimantSignDateDay,
        data.signDateDay || todayParts.day,
      );
      setTextField(
        fieldMap.claimantSignDateYear,
        data.signDateYear || todayParts.year,
      );

      // Page 3 - Limitations
      if (data.limitations) {
        setTextField(fieldMap.limitations, data.limitations);
        setTextField(fieldMap.page3SSN1, ssn.first);
        setTextField(fieldMap.page3SSN2, ssn.middle);
        setTextField(fieldMap.page3SSN3, ssn.last);
        setTextField(fieldMap.page3SignDateMonth, todayParts.month);
        setTextField(fieldMap.page3SignDateDay, todayParts.day);
        setTextField(fieldMap.page3SignDateYear, todayParts.year);
      }

      // Flatten form
      form.flatten();

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error filling VA Form 21-22a:", error);
    }
  }

  // Fallback
  return createIndividualRepPdf(data);
}

async function createIndividualRepPdf(data) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();
  let y = height - 50;

  const drawText = (text, options = {}) => {
    if (y < 80) {
      page = pdfDoc.addPage([612, 792]);
      y = height - 50;
    }
    page.drawText(text || "", {
      x: 50,
      y,
      size: options.size || 11,
      font: options.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= 14;
  };

  const drawWrappedText = (text, maxWidth = 500) => {
    const words = (text || "").split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line + (line ? " " : "") + word;
      const textWidth = font.widthOfTextAtSize(testLine, 11);
      if (textWidth > maxWidth && line) {
        drawText(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) drawText(line);
  };

  drawText("APPOINTMENT OF INDIVIDUAL AS CLAIMANT'S REPRESENTATIVE", {
    bold: true,
    size: 14,
  });
  drawText("(Reference for VA Form 21-22a)", { size: 10 });
  y -= 15;

  drawText("VETERAN INFORMATION", { bold: true });
  drawText(`Name: ${data.veteranName || ""}`);
  drawText(
    `SSN: XXX-XX-${(data.ssn || data.veteranSSN || "").slice(-4) || "XXXX"}`,
  );
  drawText(`DOB: ${data.dob || data.veteranDOB || ""}`);
  drawText(`Phone: ${data.phone || data.veteranPhone || ""}`);
  y -= 10;

  drawText("INDIVIDUAL REPRESENTATIVE", { bold: true });
  drawText(`Name: ${data.representativeName || ""}`);
  drawText(`Type: ${data.representativeType || "Attorney / Claims Agent"}`);
  drawText(`Organization/Firm: ${data.firmName || data.repOrganization || ""}`);
  drawText(`Phone: ${data.repPhone || ""}`);
  drawText(`Email: ${data.repEmail || ""}`);
  y -= 10;

  if (data.feeAgreement) {
    drawText("FEE AGREEMENT", { bold: true });
    drawWrappedText(data.feeAgreement);
    y -= 10;
  }

  drawText("IMPORTANT: Fee agreements are governed by 38 CFR § 14.636", {
    size: 9,
  });
  drawText("Fees cannot exceed 33.33% of past-due benefits awarded.", {
    size: 9,
  });
  y -= 20;

  drawText("Claimant Signature: _______________________________________");
  drawText(`Date: ${new Date().toLocaleDateString()}`);
  y -= 20;
  drawText("Representative Signature: _______________________________________");
  drawText(`Date: ${new Date().toLocaleDateString()}`);

  return pdfDoc.save();
}

/**
 * Main function to fill and download a VA form
 */
export async function fillAndDownloadForm(formType, data) {
  let pdfBytes;
  let fileName;

  switch (formType) {
    case "buddy-statement":
      pdfBytes = await fillForm21_10210(data);
      fileName = "VA_Form_21-10210_Buddy_Statement.pdf";
      break;
    case "personal-statement":
      pdfBytes = await fillForm21_4138(data);
      fileName = "VA_Form_21-4138_Personal_Statement.pdf";
      break;
    case "ptsd-stressor":
      pdfBytes = await fillForm21_0781(data);
      fileName = "VA_Form_21-0781_PTSD_Statement.pdf";
      break;
    case "intent-to-file":
      pdfBytes = await fillForm21_0966(data);
      fileName = "VA_Form_21-0966_Intent_to_File.pdf";
      break;
    case "medical-release":
      pdfBytes = await fillForm21_4142(data);
      fileName = "VA_Form_21-4142_Medical_Release.pdf";
      break;
    case "priority-processing":
      pdfBytes = await fillForm20_10207(data);
      fileName = "VA_Form_20-10207_Priority_Processing.pdf";
      break;
    case "vso-appointment":
      pdfBytes = await fillForm21_22(data);
      fileName = "VA_Form_21-22_VSO_Appointment.pdf";
      break;
    case "vso-appointment-individual":
      pdfBytes = await fillForm21_22a(data);
      fileName = "VA_Form_21-22a_Individual_Representative.pdf";
      break;
    default:
      throw new Error(`Unknown form type: ${formType}`);
  }

  // Create blob and download
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, fileName };
}

export default {
  fillAndDownloadForm,
  getFormFieldNames,
  fillForm21_10210,
  fillForm21_4138,
  fillForm21_0781,
  fillForm21_0966,
  fillForm21_4142,
  fillForm20_10207,
  fillForm21_22,
  fillForm21_22a,
};
