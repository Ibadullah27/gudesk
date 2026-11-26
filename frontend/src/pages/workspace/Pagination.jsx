export default function Pagination({ meta, page, setPage }) {
  const pages = Math.max(1, Math.ceil((meta?.total ?? 0) / (meta?.pageSize ?? 20)));
  return <nav className="pagination" aria-label="Pagination">
    <span>Page {page} of {pages}</span>
    <div><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="secondary-button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>
  </nav>;
}
