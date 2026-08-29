export const GAS_SCRIPT_CODE = `/**
 * =========================================================================
 * ONLINE EXAMINATION PORTAL - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * =========================================================================
 * 
 * Features:
 * - Google Sheets as Multi-tab Database:
 *     1. Users: [UserId, Password, Role, Name]
 *     2. Exam: [ExamId, StartTime, EndTime, QPUrl, CreatedAt, AssignmentType, AssignedGroups, AssignedStudents]
 *     3. Groups: [GroupId, Name, Description, StudentIds, CreatedAt]
 *     4. Submissions: [StudentId, ExamId, SubmissionUrl, SubmittedAt, GradedUrl, Score]
 *     5. Poctor_Logs: [Timestamp, ExamId, StudentId, ActionType, Details]
 *     6. Paper: [PaperId, ExamId, Subject, TotalMarks, FileUrl]
 *     7. Doubt: [DoubtId, StudentId, ExamId, Question, Answer, Status, CreatedAt]
 * 
 * - Google Drive Storage for PDFs (Question Papers, Answer Sheets, Graded PDFs)
 *   with public viewer permissions.
 * 
 * - CORS-Compliant JSON API with doPost(e) & doGet(e).
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Paste this entire Code.gs file.
 * 3. Click 'Deploy' -> 'New deployment' -> Select type 'Web app'.
 * 4. Set 'Execute as': "Me"
 * 5. Set 'Who has access': "Anyone" (allows student & teacher web consoles to connect)
 * 6. Copy the Web App URL and paste it into the Web App Settings in your Portal.
 * =========================================================================
 */

var DRIVE_FOLDER_NAME = "Online_Exam_Portal_Storage";

function doGet(e) {
  initAllSheets();
  return createJsonResponse({
    success: true,
    message: "Online Examination Portal Google Apps Script backend is active and running!",
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    initAllSheets();

    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action;

    switch (action) {
      case "ping":
      case "initSheets":
        return createJsonResponse({
          success: true,
          message: "Sheets successfully verified and initialized.",
          sheets: ["Users", "Exam", "Groups", "Submissions", "Poctor_Logs", "Paper", "Doubt"]
        });

      case "userLogin":
        return handleUserLogin(payload);

      case "getStudents":
        return handleGetStudents(payload);

      case "createStudent":
        return handleCreateStudent(payload);

      case "deleteStudent":
        return handleDeleteStudent(payload);

      case "getGroups":
        return handleGetGroups(payload);

      case "createGroup":
        return handleCreateGroup(payload);

      case "updateGroup":
        return handleUpdateGroup(payload);

      case "deleteGroup":
        return handleDeleteGroup(payload);

      case "createExam":
        return handleCreateExam(payload);

      case "updateExam":
        return handleUpdateExam(payload);

      case "deleteExam":
        return handleDeleteExam(payload);

      case "getAllExams":
        return handleGetAllExams(payload);

      case "submitAnswerSheet":
        return handleSubmitAnswerSheet(payload);

      case "getSubmissions":
        return handleGetSubmissions(payload);

      case "uploadGradedAnswerSheet":
        return handleUploadGradedAnswerSheet(payload);

      case "logProctorEvent":
        return handleLogProctorEvent(payload);

      case "getProctorLogs":
        return handleGetProctorLogs(payload);

      case "createDoubt":
        return handleCreateDoubt(payload);

      case "getDoubts":
        return handleGetDoubts(payload);

      case "answerDoubt":
        return handleAnswerDoubt(payload);

      default:
        return createJsonResponse({
          success: false,
          error: "Unknown action requested: '" + action + "'"
        });
    }

  } catch (err) {
    return createJsonResponse({
      success: false,
      error: "Server Error in Apps Script: " + err.toString()
    });
  }
}

function getOrCreateSheet(sheetName, headers, defaultRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.setFrozenRows(1);
    }
    if (defaultRows && defaultRows.length > 0) {
      for (var i = 0; i < defaultRows.length; i++) {
        sheet.appendRow(defaultRows[i]);
      }
    }
  } else {
    if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.setFrozenRows(1);
      if (defaultRows && defaultRows.length > 0) {
        for (var j = 0; j < defaultRows.length; j++) {
          sheet.appendRow(defaultRows[j]);
        }
      }
    }
  }

  return sheet;
}

function initAllSheets() {
  getOrCreateSheet("Users", 
    ["UserId", "Password", "Role", "Name"],
    [
      ["TCH-801", "admin123", "teacher", "Head Teacher - Dr. Evelyn Vance"],
      ["STU-101", "pass123", "student", "Demo Student - Alex Morgan"],
      ["STU-102", "pass123", "student", "Student - Priya Sharma"]
    ]
  );

  getOrCreateSheet("Exam",
    ["ExamId", "StartTime", "EndTime", "QPUrl", "CreatedAt", "AssignmentType", "AssignedGroups", "AssignedStudents"],
    []
  );

  getOrCreateSheet("Groups",
    ["GroupId", "Name", "Description", "StudentIds", "CreatedAt"],
    [
      ["GRP-B1", "Batch A - Morning Section", "Undergraduate candidates in Morning Schedule", "STU-101,STU-102", new Date().toISOString()],
      ["GRP-B2", "Batch B - Honors Lab Group", "Honors laboratory candidates", "STU-101", new Date().toISOString()]
    ]
  );

  getOrCreateSheet("Submissions",
    ["StudentId", "ExamId", "SubmissionUrl", "SubmittedAt", "GradedUrl", "Score"],
    []
  );

  getOrCreateSheet("Poctor_Logs",
    ["Timestamp", "ExamId", "StudentId", "ActionType", "Details"],
    []
  );

  getOrCreateSheet("Paper",
    ["PaperId", "ExamId", "Subject", "TotalMarks", "FileUrl"],
    []
  );

  getOrCreateSheet("Doubt",
    ["DoubtId", "StudentId", "ExamId", "Question", "Answer", "Status", "CreatedAt"],
    []
  );
}

function getStorageFolder() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  var folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function saveBase64PdfToDrive(base64Data, filename) {
  var cleanBase64 = base64Data;
  if (base64Data.indexOf(",") > -1) {
    cleanBase64 = base64Data.split(",")[1];
  }
  var decodedBytes = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decodedBytes, "application/pdf", filename);

  var folder = getStorageFolder();
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var previewUrl = "https://drive.google.com/file/d/" + fileId + "/preview";
  var directUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

  return {
    fileId: fileId,
    fileUrl: previewUrl,
    previewUrl: previewUrl,
    downloadUrl: directUrl
  };
}

function handleUserLogin(payload) {
  var userId = (payload.userId || payload.UserId || "").trim();
  var password = (payload.password || payload.Password || "").trim();
  var role = (payload.role || payload.Role || "").toLowerCase().trim();

  if (!userId || !password) {
    return createJsonResponse({ success: false, error: "User ID and password are required." });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var rowUserId = String(data[i][0]).trim();
    var rowPassword = String(data[i][1]).trim();
    var rowRole = String(data[i][2]).toLowerCase().trim();
    var rowName = String(data[i][3] || rowUserId).trim();

    if (rowUserId.toLowerCase() === userId.toLowerCase() && rowPassword === password) {
      if (role && rowRole !== role) {
        return createJsonResponse({
          success: false,
          error: "Invalid role selected. This account is registered as: " + rowRole
        });
      }

      return createJsonResponse({
        success: true,
        message: "Authentication successful!",
        user: {
          UserId: rowUserId,
          Role: rowRole,
          Name: rowName
        }
      });
    }
  }

  return createJsonResponse({
    success: false,
    error: "Invalid credentials. Please check your User ID and Password."
  });
}

function handleGetGroups(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Groups");
  if (!sheet) {
    initAllSheets();
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Groups");
  }

  var groups = [];
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var gId = String(data[i][0]).trim();
      if (!gId) continue;
      var rawStudents = String(data[i][3] || "").trim();
      var studentIds = rawStudents ? rawStudents.split(",").map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean) : [];

      groups.push({
        GroupId: gId,
        Name: String(data[i][1] || gId).trim(),
        Description: String(data[i][2] || "").trim(),
        StudentIds: studentIds,
        CreatedAt: String(data[i][4] || new Date().toISOString())
      });
    }
  }

  return createJsonResponse({ success: true, groups: groups });
}

function handleCreateGroup(payload) {
  var name = (payload.name || payload.Name || "").trim();
  var description = (payload.description || payload.Description || "").trim();
  var studentIds = Array.isArray(payload.studentIds) ? payload.studentIds : (payload.studentIds ? String(payload.studentIds).split(",") : []);
  var groupId = (payload.groupId || payload.GroupId || "GRP-" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd-HHmmss")).trim();

  if (!name) {
    return createJsonResponse({ success: false, error: "Group Name is required." });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Groups");
  if (!sheet) {
    initAllSheets();
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Groups");
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === groupId.toUpperCase()) {
      return createJsonResponse({ success: false, error: "Group ID '" + groupId + "' already exists." });
    }
  }

  var cleanStudentIds = studentIds.map(function(s) { return String(s).trim().toUpperCase(); }).filter(Boolean);
  var createdAt = new Date().toISOString();

  sheet.appendRow([groupId, name, description, cleanStudentIds.join(","), createdAt]);

  return createJsonResponse({
    success: true,
    message: "Group '" + name + "' created successfully.",
    group: {
      GroupId: groupId,
      Name: name,
      Description: description,
      StudentIds: cleanStudentIds,
      CreatedAt: createdAt
    }
  });
}

function handleUpdateGroup(payload) {
  var groupId = (payload.groupId || payload.GroupId || "").trim();
  var name = (payload.name || payload.Name || "").trim();
  var description = (payload.description || payload.Description || "").trim();
  var studentIds = Array.isArray(payload.studentIds) ? payload.studentIds : (payload.studentIds ? String(payload.studentIds).split(",") : []);

  if (!groupId) return createJsonResponse({ success: false, error: "GroupId is required." });
  if (!name) return createJsonResponse({ success: false, error: "Group Name is required." });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Groups");
  if (!sheet) return createJsonResponse({ success: false, error: "Groups sheet not found." });

  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === groupId.toUpperCase()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return createJsonResponse({ success: false, error: "Group not found: " + groupId });

  var cleanStudentIds = studentIds.map(function(s) { return String(s).trim().toUpperCase(); }).filter(Boolean);

  sheet.getRange(rowIndex, 2).setValue(name);
  sheet.getRange(rowIndex, 3).setValue(description);
  sheet.getRange(rowIndex, 4).setValue(cleanStudentIds.join(","));

  return createJsonResponse({
    success: true,
    message: "Group '" + name + "' updated successfully.",
    group: {
      GroupId: groupId,
      Name: name,
      Description: description,
      StudentIds: cleanStudentIds,
      CreatedAt: String(data[rowIndex - 1][4] || new Date().toISOString())
    }
  });
}

function handleDeleteGroup(payload) {
  var groupId = (payload.groupId || payload.GroupId || "").trim();
  if (!groupId) return createJsonResponse({ success: false, error: "GroupId is required." });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Groups");
  if (!sheet) return createJsonResponse({ success: false, error: "Groups sheet not found." });

  var data = sheet.getDataRange().getValues();
  var deleted = false;

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim().toUpperCase() === groupId.toUpperCase()) {
      sheet.deleteRow(i + 1);
      deleted = true;
      break;
    }
  }

  return createJsonResponse({
    success: deleted,
    message: deleted ? "Group '" + groupId + "' deleted successfully." : "Group ID not found."
  });
}

function handleCreateExam(payload) {
  var examId = (payload.examId || payload.ExamId || "EXAM-" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd-HHmmss")).trim();
  var startTime = payload.startTime || payload.StartTime || new Date().toISOString();
  var endTime = payload.endTime || payload.EndTime || new Date(Date.now() + 3600000).toISOString();
  var subject = payload.subject || payload.Subject || "General Examination";
  var totalMarks = Number(payload.totalMarks || payload.TotalMarks || 100);
  var qpUrl = payload.qpUrl || payload.QPUrl || "";
  var pdfBase64 = payload.pdfBase64 || payload.qpBase64 || "";
  var assignmentType = payload.assignmentType || payload.AssignmentType || "ALL";
  var assignedGroups = Array.isArray(payload.assignedGroups) ? payload.assignedGroups.join(",") : (payload.assignedGroups || "");
  var assignedStudents = Array.isArray(payload.assignedStudents) ? payload.assignedStudents.join(",") : (payload.assignedStudents || "");

  if (pdfBase64) {
    var filename = "QP_" + examId + "_" + subject.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf";
    var savedFile = saveBase64PdfToDrive(pdfBase64, filename);
    qpUrl = savedFile.fileUrl;
  }

  var createdAt = new Date().toISOString();
  var examSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Exam");
  examSheet.appendRow([examId, startTime, endTime, qpUrl, createdAt, assignmentType, assignedGroups, assignedStudents]);

  var paperId = "PPR-" + examId;
  var paperSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Paper");
  paperSheet.appendRow([paperId, examId, subject, totalMarks, qpUrl]);

  return createJsonResponse({
    success: true,
    message: "Exam created successfully with ID: " + examId,
    exam: {
      ExamId: examId,
      StartTime: startTime,
      EndTime: endTime,
      QPUrl: qpUrl,
      CreatedAt: createdAt,
      Subject: subject,
      TotalMarks: totalMarks,
      AssignmentType: assignmentType,
      AssignedGroups: assignedGroups ? assignedGroups.split(",") : [],
      AssignedStudents: assignedStudents ? assignedStudents.split(",") : []
    }
  });
}

function handleUpdateExam(payload) {
  var examId = payload.examId || payload.ExamId;
  if (!examId) return createJsonResponse({ success: false, error: "ExamId is required." });

  var examSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Exam");
  var data = examSheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(examId).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) return createJsonResponse({ success: false, error: "Exam not found: " + examId });

  var newStartTime = payload.startTime || payload.StartTime || data[rowIndex - 1][1];
  var newEndTime = payload.endTime || payload.EndTime || data[rowIndex - 1][2];
  var newQpUrl = data[rowIndex - 1][3];

  if (payload.pdfBase64) {
    var saved = saveBase64PdfToDrive(payload.pdfBase64, "QP_Updated_" + examId + ".pdf");
    newQpUrl = saved.fileUrl;
  } else if (payload.qpUrl || payload.QPUrl) {
    newQpUrl = payload.qpUrl || payload.QPUrl;
  }

  var newAssignmentType = payload.assignmentType !== undefined ? payload.assignmentType : (data[rowIndex - 1][5] || "ALL");
  var newAssignedGroups = payload.assignedGroups !== undefined ? (Array.isArray(payload.assignedGroups) ? payload.assignedGroups.join(",") : payload.assignedGroups) : (data[rowIndex - 1][6] || "");
  var newAssignedStudents = payload.assignedStudents !== undefined ? (Array.isArray(payload.assignedStudents) ? payload.assignedStudents.join(",") : payload.assignedStudents) : (data[rowIndex - 1][7] || "");

  examSheet.getRange(rowIndex, 2).setValue(newStartTime);
  examSheet.getRange(rowIndex, 3).setValue(newEndTime);
  examSheet.getRange(rowIndex, 4).setValue(newQpUrl);
  examSheet.getRange(rowIndex, 6).setValue(newAssignmentType);
  examSheet.getRange(rowIndex, 7).setValue(newAssignedGroups);
  examSheet.getRange(rowIndex, 8).setValue(newAssignedStudents);

  return createJsonResponse({ success: true, message: "Exam " + examId + " updated successfully." });
}

function handleDeleteExam(payload) {
  var examId = payload.examId || payload.ExamId;
  if (!examId) return createJsonResponse({ success: false, error: "ExamId is required." });

  var examSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Exam");
  var data = examSheet.getDataRange().getValues();
  var deleted = false;

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() === String(examId).trim()) {
      examSheet.deleteRow(i + 1);
      deleted = true;
    }
  }

  var paperSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Paper");
  if (paperSheet) {
    var pData = paperSheet.getDataRange().getValues();
    for (var j = pData.length - 1; j >= 1; j--) {
      if (String(pData[j][1]).trim() === String(examId).trim()) {
        paperSheet.deleteRow(j + 1);
      }
    }
  }

  return deleted 
    ? createJsonResponse({ success: true, message: "Exam " + examId + " deleted successfully." })
    : createJsonResponse({ success: false, error: "Exam ID not found." });
}

function handleGetAllExams() {
  var examSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Exam");
  var paperSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Paper");

  var exams = [];
  var papersMap = {};

  if (paperSheet) {
    var pData = paperSheet.getDataRange().getValues();
    for (var p = 1; p < pData.length; p++) {
      var eId = String(pData[p][1]).trim();
      papersMap[eId] = {
        PaperId: pData[p][0],
        Subject: pData[p][2],
        TotalMarks: Number(pData[p][3] || 100),
        FileUrl: pData[p][4]
      };
    }
  }

  if (examSheet) {
    var data = examSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var exId = String(data[i][0]).trim();
      if (!exId) continue;

      var paperInfo = papersMap[exId] || {};
      var rawGroups = String(data[i][6] || "").trim();
      var rawStudents = String(data[i][7] || "").trim();

      exams.push({
        ExamId: exId,
        StartTime: data[i][1],
        EndTime: data[i][2],
        QPUrl: data[i][3],
        CreatedAt: data[i][4],
        AssignmentType: data[i][5] || "ALL",
        AssignedGroups: rawGroups ? rawGroups.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [],
        AssignedStudents: rawStudents ? rawStudents.split(",").map(function(s) { return s.trim().toUpperCase(); }).filter(Boolean) : [],
        Subject: paperInfo.Subject || "General Examination",
        TotalMarks: paperInfo.TotalMarks || 100
      });
    }
  }

  return createJsonResponse({ success: true, exams: exams });
}

function handleSubmitAnswerSheet(payload) {
  var studentId = (payload.studentId || payload.StudentId || "").trim();
  var examId = (payload.examId || payload.ExamId || "").trim();
  var pdfBase64 = payload.pdfBase64 || payload.submissionBase64 || "";
  var submissionUrl = payload.submissionUrl || payload.SubmissionUrl || "";

  if (!studentId || !examId) {
    return createJsonResponse({ success: false, error: "StudentId and ExamId are required." });
  }

  if (pdfBase64) {
    var filename = "ANS_" + examId + "_" + studentId + ".pdf";
    var saved = saveBase64PdfToDrive(pdfBase64, filename);
    submissionUrl = saved.fileUrl;
  }

  if (!submissionUrl) {
    return createJsonResponse({ success: false, error: "Please upload an answer sheet PDF." });
  }

  var submittedAt = new Date().toISOString();
  var subSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");
  var data = subSheet.getDataRange().getValues();
  var existingRowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === studentId && String(data[i][1]).trim() === examId) {
      existingRowIndex = i + 1;
      break;
    }
  }

  if (existingRowIndex > -1) {
    subSheet.getRange(existingRowIndex, 3).setValue(submissionUrl);
    subSheet.getRange(existingRowIndex, 4).setValue(submittedAt);
  } else {
    subSheet.appendRow([studentId, examId, submissionUrl, submittedAt, "", ""]);
  }

  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Poctor_Logs");
  if (logSheet) {
    logSheet.appendRow([submittedAt, examId, studentId, "EXAM_SUBMIT", "Answer sheet submitted via student console."]);
  }

  return createJsonResponse({
    success: true,
    message: "Answer sheet submitted successfully!",
    submission: {
      StudentId: studentId,
      ExamId: examId,
      SubmissionUrl: submissionUrl,
      SubmittedAt: submittedAt,
      GradedUrl: "",
      Score: ""
    }
  });
}

function handleGetSubmissions(payload) {
  var examId = payload.examId || payload.ExamId || "";
  var studentId = payload.studentId || payload.StudentId || "";

  var subSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");
  var usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  
  var usersMap = {};
  if (usersSheet) {
    var uData = usersSheet.getDataRange().getValues();
    for (var u = 1; u < uData.length; u++) {
      usersMap[String(uData[u][0]).trim()] = uData[u][3] || uData[u][0];
    }
  }

  var submissions = [];
  if (subSheet) {
    var data = subSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowStuId = String(data[i][0]).trim();
      var rowExId = String(data[i][1]).trim();

      if (examId && rowExId !== examId) continue;
      if (studentId && rowStuId !== studentId) continue;

      submissions.push({
        StudentId: rowStuId,
        ExamId: rowExId,
        SubmissionUrl: data[i][2],
        SubmittedAt: data[i][3],
        GradedUrl: data[i][4] || "",
        Score: data[i][5] !== undefined ? data[i][5] : "",
        StudentName: usersMap[rowStuId] || rowStuId
      });
    }
  }

  return createJsonResponse({ success: true, submissions: submissions });
}

function handleUploadGradedAnswerSheet(payload) {
  var studentId = (payload.studentId || payload.StudentId || "").trim();
  var examId = (payload.examId || payload.ExamId || "").trim();
  var score = payload.score !== undefined ? payload.score : payload.Score;
  var gradedPdfBase64 = payload.gradedPdfBase64 || payload.pdfBase64 || "";
  var gradedUrl = payload.gradedUrl || payload.GradedUrl || "";

  if (!studentId || !examId) {
    return createJsonResponse({ success: false, error: "StudentId and ExamId are required." });
  }

  if (gradedPdfBase64) {
    var filename = "GRADED_" + examId + "_" + studentId + ".pdf";
    var saved = saveBase64PdfToDrive(gradedPdfBase64, filename);
    gradedUrl = saved.fileUrl;
  }

  var subSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Submissions");
  var data = subSheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === studentId && String(data[i][1]).trim() === examId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return createJsonResponse({ success: false, error: "Submission record not found to grade." });
  }

  if (gradedUrl) subSheet.getRange(rowIndex, 5).setValue(gradedUrl);
  if (score !== undefined && score !== "") subSheet.getRange(rowIndex, 6).setValue(score);

  return createJsonResponse({
    success: true,
    message: "Grading updated successfully.",
    gradedUrl: gradedUrl,
    score: score
  });
}

function handleLogProctorEvent(payload) {
  var timestamp = payload.timestamp || new Date().toISOString();
  var examId = payload.examId || payload.ExamId || "GENERAL";
  var studentId = payload.studentId || payload.StudentId || "ANONYMOUS";
  var actionType = payload.actionType || payload.ActionType || "GENERAL_EVENT";
  var details = payload.details || payload.Details || "";

  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Poctor_Logs");
  logSheet.appendRow([timestamp, examId, studentId, actionType, details]);

  return createJsonResponse({ success: true, message: "Proctor event recorded." });
}

function handleGetProctorLogs(payload) {
  var examId = payload.examId || payload.ExamId || "";
  var studentId = payload.studentId || payload.StudentId || "";

  var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Poctor_Logs");
  var logs = [];

  if (logSheet) {
    var data = logSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowExId = String(data[i][1]).trim();
      var rowStuId = String(data[i][2]).trim();

      if (examId && rowExId !== examId) continue;
      if (studentId && rowStuId !== studentId) continue;

      logs.push({
        Timestamp: data[i][0],
        ExamId: rowExId,
        StudentId: rowStuId,
        ActionType: data[i][3],
        Details: data[i][4]
      });
    }
  }

  return createJsonResponse({ success: true, logs: logs.reverse() });
}

function handleCreateDoubt(payload) {
  var doubtId = "DBT-" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd-HHmmss");
  var studentId = payload.studentId || payload.StudentId || "";
  var examId = payload.examId || payload.ExamId || "";
  var question = payload.question || payload.Question || "";
  var createdAt = new Date().toISOString();

  if (!question || !studentId || !examId) {
    return createJsonResponse({ success: false, error: "Question, studentId, and examId required." });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Doubt");
  sheet.appendRow([doubtId, studentId, examId, question, "", "OPEN", createdAt]);

  return createJsonResponse({
    success: true,
    message: "Question submitted to teacher.",
    doubt: {
      DoubtId: doubtId,
      StudentId: studentId,
      ExamId: examId,
      Question: question,
      Answer: "",
      Status: "OPEN",
      CreatedAt: createdAt
    }
  });
}

function handleGetDoubts(payload) {
  var examId = payload.examId || payload.ExamId || "";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Doubt");
  var usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  
  var usersMap = {};
  if (usersSheet) {
    var uData = usersSheet.getDataRange().getValues();
    for (var u = 1; u < uData.length; u++) {
      usersMap[String(uData[u][0]).trim()] = uData[u][3] || uData[u][0];
    }
  }

  var doubts = [];
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowExId = String(data[i][2]).trim();
      var rowStuId = String(data[i][1]).trim();
      if (examId && rowExId !== examId) continue;

      doubts.push({
        DoubtId: data[i][0],
        StudentId: rowStuId,
        ExamId: rowExId,
        Question: data[i][3],
        Answer: data[i][4] || "",
        Status: data[i][5] || "OPEN",
        CreatedAt: data[i][6],
        StudentName: usersMap[rowStuId] || rowStuId
      });
    }
  }

  return createJsonResponse({ success: true, doubts: doubts.reverse() });
}

function handleAnswerDoubt(payload) {
  var doubtId = payload.doubtId || payload.DoubtId || "";
  var answer = payload.answer || payload.Answer || "";

  if (!doubtId || !answer) {
    return createJsonResponse({ success: false, error: "doubtId and answer required." });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Doubt");
  var data = sheet.getDataRange().getValues();
  var foundIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(doubtId).trim()) {
      foundIndex = i + 1;
      break;
    }
  }

  if (foundIndex === -1) return createJsonResponse({ success: false, error: "Doubt ID not found." });

  sheet.getRange(foundIndex, 5).setValue(answer);
  sheet.getRange(foundIndex, 6).setValue("ANSWERED");

  return createJsonResponse({ success: true, message: "Answer sent to student." });
}

function handleGetStudents(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Users");
  var students = [];
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var role = String(data[i][2]).toLowerCase().trim();
      if (role === "student") {
        students.push({
          UserId: String(data[i][0]).trim(),
          Role: "student",
          Name: String(data[i][3] || data[i][0]).trim()
        });
      }
    }
  }
  return createJsonResponse({ success: true, students: students });
}

function handleCreateStudent(payload) {
  var studentId = (payload.studentId || payload.UserId || "").trim().toUpperCase();
  var name = (payload.name || payload.Name || "").trim();
  var password = (payload.password || payload.Password || "").trim();
  var role = (payload.role || "student").toLowerCase().trim();

  if (role !== "student") {
    return createJsonResponse({
      success: false,
      error: "Security Policy: Teacher accounts cannot be created via this endpoint. Teacher accounts must be created directly by administrators in the Google Spreadsheet 'Users' sheet."
    });
  }

  if (!studentId || !name || !password) {
    return createJsonResponse({
      success: false,
      error: "Student ID, Name, and Password are all required."
    });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) {
    initAllSheets();
    sheet = ss.getSheetByName("Users");
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === studentId) {
      return createJsonResponse({
        success: false,
        error: "User ID '" + studentId + "' already exists in the Users database."
      });
    }
  }

  sheet.appendRow([studentId, password, "student", name]);

  return createJsonResponse({
    success: true,
    message: "Student account " + studentId + " created successfully in Users sheet.",
    student: {
      UserId: studentId,
      Name: name,
      Role: "student"
    }
  });
}

function handleDeleteStudent(payload) {
  var studentId = (payload.studentId || payload.UserId || "").trim().toUpperCase();
  if (!studentId) {
    return createJsonResponse({ success: false, error: "studentId is required." });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet) return createJsonResponse({ success: false, error: "Users sheet not found." });

  var data = sheet.getDataRange().getValues();
  var deleted = false;

  for (var i = data.length - 1; i >= 1; i--) {
    var rowId = String(data[i][0]).trim().toUpperCase();
    var role = String(data[i][2]).toLowerCase().trim();

    if (rowId === studentId) {
      if (role === "teacher") {
        return createJsonResponse({
          success: false,
          error: "Teacher accounts cannot be removed from this console. Modify the Users sheet directly."
        });
      }
      sheet.deleteRow(i + 1);
      deleted = true;
      break;
    }
  }

  return createJsonResponse({
    success: deleted,
    message: deleted ? "Student account " + studentId + " removed from Users sheet." : "Student account not found."
  });
}

function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
`;
