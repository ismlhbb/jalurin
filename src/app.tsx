import { Plus, SearchMd, X } from "@untitled-ui/icons-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import React from "react";
import Footer from "./components/footer";
import { StationItem } from "./components/station-item";
import { TripPlanner } from "./components/trip-planner";
import { useLanguage } from "./hooks/use-language";
import { useMeasure } from "./hooks/use-measure";
import { usePersistedState } from "./hooks/use-persisted-state";
import { useStations } from "./hooks/use-stations";
import { cn, createKey } from "./utils";

export function App() {
  const [state, setState] = React.useState<"VIEW" | "SEARCH" | "ADD" | "TRIP">(
    "VIEW",
  );
  const [isTrip, setIsTrip] = React.useState(false);

  React.useEffect(() => {
    setIsTrip(state === "TRIP");
  }, [state]);

  const [ref, height] = useMeasure<HTMLDivElement>();

  const [addSearch, setAddSearch] = React.useState("");
  const [viewSearch, setViewSearch] = React.useState("");

  const [savedStations, setSavedStations] = usePersistedState<
    {
      id: string;
      name: string;
      saved_at: string;
    }[]
  >(createKey(["stations", "saved"]), [
    { id: "MRI", name: "Manggarai", saved_at: new Date().toISOString() },
    { id: "DP", name: "Depok", saved_at: new Date().toISOString() },
  ]);

  const { data: stations } = useStations();
  const { t } = useLanguage();

  /*   useOnClickOutside(ref, () => {
    if (state !== "ADD") {
      setState("VIEW");
    }
  }); */

  return (
    <div className="min-w-screen flex min-h-screen flex-col">
      <section
        className={cn("mx-auto flex w-full max-w-[500px] flex-col gap-0")}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            animate={{ height: height ?? "76px" }}
            className="fixed inset-0 z-20 mx-auto min-h-[76px] w-full max-w-[500px] bg-white will-change-auto"
          >
            <nav ref={ref} className={cn("flex flex-col gap-2 py-5")}>
              <div className="flex flex-col gap-2">
                <div className="flex w-full items-center justify-between gap-2 px-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <MotionConfig>
                      {state === "SEARCH" ? (
                        <motion.div
                          key="search"
                          initial={{
                            opacity: 0,
                            y: "-100%",
                            filter: "blur(15px)",
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            filter: "blur(0px)",
                          }}
                          exit={{
                            opacity: 0,
                            y: "100%",
                            filter: "blur(15px)",
                          }}
                          className={
                            "flex w-full items-center justify-between gap-2 rounded-md bg-zinc-100 px-2 py-0.5 will-change-transform"
                          }
                        >
                          <span className="p-1.5 opacity-50 transition duration-200 ease-in-out hover:opacity-100">
                            <SearchMd className="size-5" />
                          </span>
                          <input
                            placeholder={t("Cari stasiun")}
                            autoFocus
                            onChange={(e) => setViewSearch(e.target.value)}
                            className="text-md w-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-transparent"
                          />
                          <motion.button
                            transition={{
                              type: "spring",
                              duration: 0.8,
                              bounce: 0.3,
                            }}
                            whileTap={{ scale: 0.75 }}
                            onClick={() => {
                              setState("VIEW");
                              setViewSearch("");
                            }}
                            className="p-1.5 opacity-50 transition duration-200 ease-in-out hover:opacity-100"
                          >
                            <X className="size-5" />
                          </motion.button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="logo"
                          initial={{
                            opacity: 0,
                            y: "100%",
                            filter: "blur(15px)",
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            filter: "blur(0px)",
                          }}
                          exit={{
                            opacity: 0,
                            y: "-100%",
                            filter: "blur(15px)",
                          }}
                          className={
                            "flex w-full items-center justify-between gap-2 will-change-transform"
                          }
                        >
                          <div className="flex items-center gap-1 py-1 opacity-50 transition duration-300 hover:opacity-100">
                            <svg
                              width="25"
                              height="25"
                              viewBox="0 0 250 250"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M91.7793 124.5L122.366 62H200M91.7793 124.5L75.4906 157.784H50M91.7793 124.5L122.366 187H200M91.7793 124.5L75.4906 91.2157H50"
                                stroke="currentColor"
                                strokeWidth="20"
                              />
                            </svg>
                            <h1 className="font-mono text-lg tracking-tight">
                              Jalurin
                            </h1>
                          </div>
                          {state === "VIEW" ? (
                            <div className="flex items-center gap-1">
                              <motion.button
                                whileTap={{ scale: 0.75 }}
                                initial={{ visibility: "hidden" }}
                                animate={{ visibility: "visible" }}
                                exit={{ visibility: "hidden" }}
                                onClick={() => setState("TRIP")}
                                className="rounded-md p-1.5 transition duration-200 ease-in-out hover:bg-zinc-100"
                                title="Trip Planner"
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="6" cy="19" r="3" />
                                  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                                  <circle cx="18" cy="5" r="3" />
                                </svg>
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.75 }}
                                initial={{ visibility: "hidden" }}
                                animate={{ visibility: "visible" }}
                                exit={{ visibility: "hidden" }}
                                onClick={() => setState("SEARCH")}
                                className="rounded-md p-1.5 transition duration-200 ease-in-out hover:bg-zinc-100"
                              >
                                <SearchMd className="size-5" />
                              </motion.button>
                            </div>
                          ) : null}
                        </motion.div>
                      )}
                    </MotionConfig>
                  </AnimatePresence>
                  <motion.button
                    whileTap={{ scale: 0.75 }}
                    onClick={() => {
                      setState((prev) => {
                        if (prev === "ADD") {
                          setAddSearch("");
                        }
                        return prev === "ADD" ? "VIEW" : "ADD";
                      });
                    }}
                    data-state={isTrip ? "closed" : "open"}
                    className={cn(
                      "rounded-md p-2 transition hover:bg-zinc-100",
                      isTrip && "pointer-events-none opacity-0",
                    )}
                  >
                    <Plus
                      className={cn(
                        "size-5 transition-transform duration-200 ease-in-out",
                        {
                          "rotate-45": state === "ADD",
                          "rotate-0": state !== "ADD",
                        },
                      )}
                    />
                  </motion.button>
                </div>
                {state === "ADD" ? (
                  <motion.div
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: 1,
                    }}
                    exit={{
                      opacity: 0,
                    }}
                    className="flex h-full w-full flex-col gap-3"
                  >
                    <div className="px-4">
                      <motion.div
                        initial={{
                          opacity: 0,
                          y: "-100%",
                          filter: "blur(15px)",
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                        }}
                        exit={{
                          opacity: 0,
                          y: "100%",
                          filter: "blur(15px)",
                        }}
                        className={
                          "flex w-full items-center justify-between gap-2 rounded-md bg-zinc-100 px-2 py-0.5 will-change-transform"
                        }
                      >
                        <span className="p-1.5 opacity-50 transition duration-200 ease-in-out hover:opacity-100">
                          <SearchMd className="size-5" />
                        </span>
                        <input
                          placeholder={t("Cari stasiun")}
                          autoFocus
                          onChange={(e) => setAddSearch(e.target.value)}
                          value={addSearch}
                          className="text-md w-full bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-transparent"
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </nav>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          {state === "TRIP" ? (
            <motion.section
              key="trip"
              transition={{ type: "spring", duration: 0.8, bounce: 0.3 }}
              initial={{ opacity: 0, filter: "blur(20px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(20px)" }}
              style={{ marginTop: "76px" }}
              className="mx-auto flex h-fit w-full max-w-[500px] flex-col py-6"
            >
              <TripPlanner onBack={() => setState("VIEW")} />
            </motion.section>
          ) : state === "ADD" ? (
            <motion.section
              key="add-station"
              transition={{
                type: "spring",
                duration: 0.8,
                bounce: 0.3,
              }}
              initial={{
                opacity: 0,
                filter: "blur(20px)",
              }}
              animate={{
                opacity: 1,
                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                filter: "blur(20px)",
              }}
              style={{
                marginTop: "110px",
              }}
              className="mx-auto flex h-fit w-full max-w-[500px] flex-col px-4"
            >
              {(() => {
                const filtered = (stations?.data || [])
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter((station) => {
                    if (addSearch === "") return true;
                    return station.name
                      .toLowerCase()
                      .includes(addSearch.toLowerCase());
                  });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
                      <span className="text-md opacity-50">
                        {t("Stasiun {{addSearch}} tidak dapat ditemukan", {
                          addSearch,
                        })}
                      </span>
                    </div>
                  );
                }

                return filtered.map((station) => {
                  const isSaved = savedStations.some(
                    ({ id }) => id === station.id,
                  );

                  return (
                    <motion.button
                      key={station.id}
                      whileTap={{ scale: 0.95 }}
                      disabled={isSaved && savedStations.length === 1}
                      className="flex items-center justify-between rounded-md p-2 text-left capitalize transition hover:bg-zinc-100"
                      onClick={() => {
                        setSavedStations((prev) => {
                          const isSaved = prev.some(
                            ({ id }) => id === station.id,
                          );

                          if (isSaved) {
                            return prev.filter(({ id }) => id !== station.id);
                          }

                          return [
                            ...prev,
                            {
                              id: station.id,
                              name: station.name,
                              saved_at: new Date().toISOString(),
                            },
                          ];
                        });
                      }}
                    >
                      <span>{station.name.toLowerCase()}</span>
                      {savedStations.length === 1 && isSaved ? null : (
                        <Plus
                          className={cn(
                            "size-5 transition-transform duration-200 ease-in-out",
                            {
                              "-rotate-45 opacity-30": isSaved,
                              "rotate-0 opacity-100": !isSaved,
                            },
                          )}
                        />
                      )}
                    </motion.button>
                  );
                });
              })()}
            </motion.section>
          ) : (
            <motion.section
              key="view-station"
              transition={{
                type: "spring",
                duration: 0.8,
                bounce: 0.3,
              }}
              initial={{
                opacity: 0,

                filter: "blur(20px)",
              }}
              animate={{
                opacity: 1,

                filter: "blur(0px)",
              }}
              exit={{
                opacity: 0,
                filter: "blur(20px)",
              }}
              style={{
                marginTop: "60px",
              }}
              className="mx-auto flex h-fit w-full max-w-[500px] flex-col px-5"
            >
              {(() => {
                const filtered = savedStations
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter((station) => {
                    return station.name
                      .toLowerCase()
                      .includes(viewSearch.toLowerCase());
                  });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
                      <h1 className="text-md opacity-80">
                        {t("Stasiun belum ditambahkan")}
                      </h1>
                      <span className="text-sm opacity-50">
                        {t("Tambahkan stasiun dengan menekan tombol")} +
                      </span>
                    </div>
                  );
                }

                return filtered.map(({ id: stationId }) => (
                  <StationItem key={stationId} stationId={stationId} />
                ));
              })()}
            </motion.section>
          )}
        </AnimatePresence>

        <Footer />
      </section>
    </div>
  );
}