import os
import json
from osu_file_parser import create_stats_entry
OSU_FILES_DIRPATH = "C:/programming-tools/projects/Wakasagihime-dev/osu_scout_analyser/2026_06_02_osu_files"
DB_DUMP_DIRPATH = "C:/programming-tools/projects/Wakasagihime-dev/osu_scout_analyser/db_2026_06_02"
CHUNK_SIZE = 5000

osu_fpaths = []
for fn in os.listdir(OSU_FILES_DIRPATH):
    osu_fpaths.append((os.path.join(OSU_FILES_DIRPATH, fn), True))

osu_fpaths_chunks = [osu_fpaths[i:i+CHUNK_SIZE]
                     for i in range(0, len(osu_fpaths), CHUNK_SIZE)]
results = []

total_minus_last_chunk = sum(
    [len(c) for c in osu_fpaths_chunks[:len(osu_fpaths_chunks) - 1]])

i = 0
errors = []
if __name__ == "__main__":
    from concurrent.futures import ProcessPoolExecutor, as_completed

    with ProcessPoolExecutor(max_workers=5) as executor:
        for c in osu_fpaths_chunks:
            fs = [executor.submit(create_stats_entry, arg[0], arg[1])
                  for arg in c]
            for fut in as_completed(fs):
                i += 1
                res = fut.result()
                if not isinstance(res, str):
                    results.append(res)
                else:
                    errors.append(res)
                if i <= total_minus_last_chunk:
                    if i % CHUNK_SIZE == 0:
                        with open(os.path.join(DB_DUMP_DIRPATH, f"{(i // CHUNK_SIZE)}.json"), "w", encoding="utf-8") as jfp:
                            json.dump(results, jfp,
                                      ensure_ascii=False, indent=2)
                            results = []
                        print(
                            f"{(i // CHUNK_SIZE)} chunks out of {len(osu_fpaths_chunks)} chunks completed.")

                else:
                    if i % len(osu_fpaths_chunks[-1]) == 0:
                        with open(os.path.join(DB_DUMP_DIRPATH, f"{len(osu_fpaths_chunks)}.json"), "w", encoding="utf-8") as ljfp:
                            json.dump(results, ljfp,
                                      ensure_ascii=False, indent=2)
                            results = []
                        print(f"{len(osu_fpaths_chunks)} completed.")

    with open("err.txt", "w", encoding="utf-8") as fp:
        fp.write("\n".join(errors))
