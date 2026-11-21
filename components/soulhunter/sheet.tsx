"use client";

import { useState } from "react";
import { Dock, type PageKey } from "./dock";
import { PageOne } from "./page-one";
import { PageTwo } from "./page-two";

export function Sheet() {
  const [page, setPage] = useState<PageKey>("one");

  return (
    <div className="relative">
      <div
        className={page === "one" ? undefined : "invisible absolute inset-x-0 top-0"}
        aria-hidden={page !== "one"}
        inert={page !== "one"}
        data-page-hidden={page !== "one"}
      >
        <PageOne />
      </div>
      <div
        className={page === "two" ? undefined : "invisible absolute inset-x-0 top-0"}
        aria-hidden={page !== "two"}
        inert={page !== "two"}
        data-page-hidden={page !== "two"}
      >
        <PageTwo />
      </div>
      <Dock page={page} onPageChange={setPage} />
    </div>
  );
}
