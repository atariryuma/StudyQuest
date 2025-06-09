function loadDashboardData(teacherCode) {
  return {
    tasks: listTasks(teacherCode),
    students: listStudents(teacherCode)
  };
}
