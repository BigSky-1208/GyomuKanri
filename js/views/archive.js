// ... existing code ...

  // Paginate the dates (7 dates per page)
  const datesPerPage = 7;
  const startIndex = archiveDatePageIndex * datesPerPage;
   // Ensure startIndex is not negative
   if (startIndex < 0) archiveDatePageIndex = 0;
   // const actualStartIndex = Math.max(0, archiveDatePageIndex * datesPerPage); // Recalculate based on potentially adjusted index - THIS VARIABLE IS UNUSED, REMOVE IT

   const totalPages = Math.ceil(allActiveDates.length / datesPerPage);
   // Ensure page index does not exceed total pages
   if (archiveDatePageIndex >= totalPages && totalPages > 0) {
       archiveDatePageIndex = totalPages - 1;
   } else if (totalPages === 0) {
       archiveDatePageIndex = 0; // Handle case with no dates
   }
   const finalStartIndex = Math.max(0, archiveDatePageIndex * datesPerPage); // Final calculation


   // const datesToShow = allActiveDates.slice( // Change const to let
   let datesToShow = allActiveDates.slice(
    finalStartIndex,
    finalStartIndex + datesPerPage
  );


  if (datesToShow.length === 0 && allActiveDates.length > 0) {
     // If datesToShow is empty but there are active dates, likely went past the last page
     archiveDatePageIndex = totalPages - 1; // Go to the last page
     const lastPageStartIndex = Math.max(0, archiveDatePageIndex * datesPerPage);
     datesToShow = allActiveDates.slice(lastPageStartIndex, lastPageStartIndex + datesPerPage); // Reassign let variable
  } else if (datesToShow.length === 0 && allActiveDates.length === 0) {
     // No dates at all
     weeklyContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">この工数に関する稼働記録はありません。</p>';
     weeklyContainer.classList.remove("hidden");
// ... existing code ...
