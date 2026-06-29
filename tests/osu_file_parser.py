import os
from typing import Literal
import math
import bisect
import rosu_pp_py
from urllib.parse import quote


# utility functions


def circle_radius_from_cs(cs: float) -> float:
    return 54.4 - 4.48 * cs

# classes


class TimingPoint:
    def __init__(self, time_point: float, beat_length: float = 0.0, slider_velocity: float = 0.0) -> None:
        self.time_point = time_point
        self.slider_velocity = slider_velocity
        self.beat_length = beat_length
        if beat_length != 0.0:
            self.bpm: int = math.ceil(60e3 / beat_length)


class HitObject:
    def __init__(self, object_type: Literal["circle", "slider", "buzz_slider", "spinner"], closest_timing_point: TimingPoint) -> None:
        self.object_type: Literal["circle", "slider",
                                  "buzz_slider", "spinner"] = object_type
        self.x: float = 0.0
        self.y: float = 0.0
        self.time: float = 0.0
        self.closest_timing_point: TimingPoint = closest_timing_point
        self.pattern_type: Literal["spinner", "jump", "stream",
                                   "begin-stream", "end-stream", "irregular", ""] = ""

        if object_type == "slider" or object_type == "buzz_slider":
            self.slider_length: float = 0.0
            self.slider_duration: float = 0.0
            self.slider_shape: str = ""
            self.num_slides: int = 0

    def calc_slider_duration(self, slider_multiplier: float) -> None:
        if self.closest_timing_point.slider_velocity != 0 and (self.object_type == "slider" or self.object_type == "buzz_slider"):
            self.slider_duration = self.num_slides * self.slider_length * self.closest_timing_point.beat_length / \
                (slider_multiplier * 100 * ((100 / abs(self.closest_timing_point.slider_velocity))
                 if self.closest_timing_point.slider_velocity < 0 else 1))


class Beatmap:
    def __init__(self, fpath: str, star_rating: float = 0.0, tags: str = "") -> None:
        self.fpath: str = fpath
        self.slider_multiplier: float = 0.0
        self.cs: float = 0.0
        self.timing_points: list[TimingPoint] = []
        # tuple contains [beatLength,bpm]
        self.bpm_changes: list[dict[float, tuple[float, int]]] = []
        self.hit_objects: list[HitObject] = []
        self.bpm_list: list[int] = []
        self.beatmapID: int = -1
        self.AR: float = 0.0
        self.dominant_bpm: int = 0
        self.title: str = ""
        self.creator: str = ""
        self.artist: str = ""
        self.star_rating = star_rating
        self.tags: str = tags
        self.version: str = ""
        self.beatmapsetID: int = -1

    # tuple contains [beatLength,bpm]
    def get_dominant_bpm_change(self) -> dict[float, tuple[float, int]]:
        if len(self.bpm_changes) == 1:
            self.dominant_bpm = list(self.bpm_changes[0].values())[0][1]
            return self.bpm_changes[0]

        interval = None
        dominant = None
        for c1, c2 in zip(self.bpm_changes, self.bpm_changes[1:]):
            calc = float(list(c2.keys())[0]) - float(list(c1.keys())[0])
            if interval is None:
                interval = calc
                dominant = c1
            elif calc > interval:
                interval = calc
                dominant = c1

        if self.hit_objects[-1].time - float(list(self.bpm_changes[-1].keys())[0]) > interval:
            self.dominant_bpm = list(self.bpm_changes[-1].values())[0][1]
            return self.bpm_changes[-1]
        self.dominant_bpm = list(dominant.values())[0][1]
        return dominant

    def parse(self):
        with open(self.fpath, "r", encoding="utf-8") as fp:
            lines = [line.strip() for line in fp.readlines()]
            # indices of different sections of .osu file format in lines list
            general_idx = lines.index("[General]")
            difficulty_idx = lines.index("[Difficulty]")
            timing_points_idx = lines.index("[TimingPoints]")
            hit_object_idx = lines.index("[HitObjects]")
            metadata_idx = lines.index("[Metadata]")
            # loop to check if game mode is osu!
            for line in lines[general_idx+1:]:
                if line[0:5] == "Mode:":
                    mode = int(line.strip().split(":")[1])
                    if mode != 0:
                        return "Mode is not osu!"
                    break
            # loop to get beatmap ID from ["Metadata"]
            for line in lines[metadata_idx+1:]:
                if not line:
                    break
                if ":" in line:
                    if "BeatmapID" in line:
                        self.beatmapID = int(line.split(":")[1])
                    if line.lower().split(":")[0] == "creator":
                        self.creator = line.split(":")[1]
                    elif line.lower().split(":")[0] == "title":
                        self.title = line.split(":")[1]
                    elif line.lower().split(":")[0] == "artist":
                        self.artist = line.split(":")[1]
                    elif line.lower().split(":")[0] == "tags":
                        self.tags = line.split(":")[1]
                    elif line.lower().split(":")[0] == "version":
                        self.version = line.split(":")[1]
                    elif line.lower().split(":")[0] == "beatmapsetid":
                        self.beatmapsetID = int(line.split(":")[1])
            # loop to get SliderMultiplier and CircleSize from [Difficulty]
            for line in lines[difficulty_idx+1:]:
                if not line:
                    break
                if self.slider_multiplier is not None:
                    if "SliderMultiplier" in line:
                        self.slider_multiplier = float(
                            line.strip().split(":")[1])
                if self.cs is not None:
                    if "CircleSize" in line:
                        self.cs = float(line.strip().split(":")[1])
                if self.AR is not None:
                    if "ApproachRate" in line:
                        self.AR = float(line.strip().split(":")[1])
            # loop to get all timing points
            curr_slider_v = None
            # # find first BPM change to avoid problems
            first_bpm_line = [line for line in lines[timing_points_idx+1:]
                              [:lines[timing_points_idx+1:].index("")] if float(line.split(",")[1]) > 0][0].split(",")
            self.bpm_changes.append({float(first_bpm_line[0]): (
                float(first_bpm_line[1]), int(60e3/float(first_bpm_line[1])))})

            for i, line in enumerate(lines[timing_points_idx+1:], start=timing_points_idx+1):
                if line.strip():
                    items = line.strip().split(",")
                    if float(items[1]) > 0:
                        timing_point = TimingPoint(
                            float(items[0]), beat_length=float(items[1]))
                        self.timing_points.append(timing_point)
                        self.bpm_changes.append({timing_point.time_point: (
                            timing_point.beat_length, timing_point.bpm)})
                        self.bpm_list.append(timing_point.bpm)
                        if curr_slider_v is None:
                            next_line = lines[i+1].strip()
                            if next_line:
                                bl_or_sv = float(next_line.split(",")[1])
                                if bl_or_sv >= 0 or not self.timing_points[-1].time_point == float(next_line.split(",")[0]):
                                    self.timing_points[-1].slider_velocity = 1
                                elif bl_or_sv < 0 and self.timing_points[-1].time_point == float(next_line.split(",")[0]):
                                    self.timing_points[-1].slider_velocity = bl_or_sv
                            else:
                                self.timing_points[-1].slider_velocity = 1
                        else:
                            self.timing_points[-1].slider_velocity = curr_slider_v

                    else:
                        if curr_slider_v == float(items[1]):
                            continue
                        curr_slider_v = float(items[1])
                        b = list(self.bpm_changes[-1].values())[0]
                        if len(self.timing_points):
                            if float(items[0]) == self.timing_points[-1].time_point:
                                self.timing_points[-1].slider_velocity = curr_slider_v
                                self.timing_points[-1].beat_length = b[0]
                                self.timing_points[-1].bpm = b[1]
                                continue
                        self.timing_points.append(TimingPoint(
                            float(items[0]), slider_velocity=curr_slider_v))
                        self.timing_points[-1].beat_length = b[0]
                        self.timing_points[-1].bpm = b[1]
                else:
                    break
            # loop to get all hit objects
            tp_times = [tp.time_point for tp in self.timing_points]
            for line in lines[hit_object_idx+1:]:
                if line.strip():
                    items = line.strip().split(",")
                    x = float(items[0])
                    y = float(items[1])
                    time = float(items[2])
                    # closest_timing_point = max((tp for tp in self.timing_points if tp.time_point <= time), key=lambda tp: tp.time_point, default=self.timing_points[0])
                    closest_timing_point = self.timing_points[bisect.bisect_right(
                        tp_times, time) - 1]
                    obj_flags = int(items[3])
                    if obj_flags & 1:  # circle
                        hit_object = HitObject("circle", closest_timing_point)
                        hit_object.x = x
                        hit_object.y = y
                        hit_object.time = time
                    elif obj_flags & 2:  # slider
                        # parse other slider details
                        comma_list = [i for i, c in enumerate(
                            line.strip()) if c == ","]
                        slider_str = line.strip()[comma_list[4]+1:]
                        hit_object = HitObject("slider", closest_timing_point)
                        hit_object.x = x
                        hit_object.y = y
                        hit_object.time = time
                        hit_object.slider_shape = slider_str[0]
                        for s in slider_str.split("|"):
                            if "," in s:
                                props = s.split(",")
                                hit_object.num_slides = int(props[1])
                                hit_object.slider_length = float(props[2])
                                # check if buzz slider
                                if hit_object.num_slides > 1:
                                    hit_object.object_type = "buzz_slider"
                                break
                        hit_object.calc_slider_duration(self.slider_multiplier)
                    elif obj_flags & 8:  # spinner
                        hit_object = HitObject("spinner", closest_timing_point)
                        hit_object.x = x
                        hit_object.y = y
                        hit_object.time = time

                    self.hit_objects.append(hit_object)

                else:
                    break

    def get_patterns(self):
        '''
        Sets the `pattern_type` variable of each hit object. Run before trying
        to get pattern sections!
        '''
        if not len(self.hit_objects):
            return
        dominant_bl = list(self.get_dominant_bpm_change().values())[0][0]
        for i in range(len(self.hit_objects)):
            if self.hit_objects[i].object_type == "spinner":
                self.hit_objects[i].pattern_type = "spinner"
                continue

            if i == len(self.hit_objects) - 1:
                if i == 0:
                    self.hit_objects[i].pattern_type = "jump"
                elif self.hit_objects[i-1].pattern_type == "spinner":
                    self.hit_objects[i].pattern_type = "jump"
                break

            pattern: Literal["spinner", "jump", "stream",
                             "begin-stream", "end-stream", "irregular"] = ""
            hobj1 = self.hit_objects[i]
            hobj2 = self.hit_objects[i+1]
            bl = hobj1.closest_timing_point.beat_length
            one_one = round(bl)
            one_two = round(bl / 2)
            one_four = round(bl / 4)
            end1 = hobj1.time
            end2 = hobj2.time
            if "slider" in hobj1.object_type:
                end1 += hobj1.slider_duration
            if "slider" in hobj2.object_type:
                end2 += hobj2.slider_duration

            # JUMPS calculate right
            pred_right_one = abs(hobj2.time - end1 - one_one)
            pred_right_two = abs(hobj2.time - end1 - one_two)
            # STREAMS calculate right
            pred_right_four = abs(hobj2.time - hobj1.time - one_four)

            if i == 0:
                if bl == hobj2.closest_timing_point.beat_length and (pred_right_two < 3 or pred_right_one < 3 or end1 + one_one < hobj2.time):
                    self.hit_objects[i].pattern_type = "jump"
                elif bl != hobj2.time and ((end1 + dominant_bl) < hobj2.time or abs(end1 + dominant_bl - hobj2.time) < 3 or abs(end1 + dominant_bl/2 - hobj2.time) < 3):
                    self.hit_objects[i].pattern_type = "jump"
                else:
                    self.hit_objects[i].pattern_type = "irregular"
                continue

            hobj0 = self.hit_objects[i-1]
            end0 = hobj0.time
            if "slider" in hobj0.object_type:
                end0 += hobj0.slider_duration

            if i == len(self.hit_objects) - 2 and hobj2.object_type == "spinner":
                hobj2.pattern_type = "spinner"
            elif i == len(self.hit_objects) - 2 and bl != hobj2.closest_timing_point.beat_length:
                if ((end1 + dominant_bl) < hobj2.time or abs(end1 + dominant_bl - hobj2.time) < 3 or abs(end1 + dominant_bl/2 - hobj2.time) < 3):
                    hobj2.pattern_type = "jump"
                else:
                    hobj2.pattern_type = "irregular"

            # JUMPS calculate left
            pred_left_one = abs(hobj1.time - end0 - one_one)
            pred_left_two = abs(hobj1.time - end0 - one_two)
            # STREAMS calculate left
            pred_left_four = abs(hobj1.time - hobj0.time - one_four)

            # timing/bpm change between at least two hit objects
            if hobj0.closest_timing_point.beat_length != hobj1.closest_timing_point.beat_length or hobj1.closest_timing_point.beat_length != hobj2.closest_timing_point.beat_length or hobj0.closest_timing_point.beat_length != hobj2.closest_timing_point.beat_length:
                if ((end0 + dominant_bl) < hobj1.time or abs(end0 + dominant_bl - hobj1.time) < 3 or abs(end0 + dominant_bl/2 - hobj1.time) < 3) and ((end1 + dominant_bl) < hobj2.time or abs(end1 + dominant_bl - hobj2.time) < 3 or abs(end1 + dominant_bl/2 - hobj2.time) < 3):
                    pattern = "jump"
                else:
                    pattern = "irregular"

            # what is a jump?
            elif (hobj2.time > (end1 + one_one) or pred_right_one < 3 or pred_right_two < 3) and ((end0 + one_one) < hobj1.time or pred_left_one < 3 or pred_left_two < 3):
                pattern = "jump"
                # below is added because we break loop on last item early ([i+1] index not possible)
                if i == len(self.hit_objects) - 2 and self.hit_objects[i+1].object_type != "spinner":
                    hobj2.pattern_type = "jump"

            # what is a stream?
            elif hobj0.object_type == "circle" and hobj1.object_type == "circle" and pred_left_four < 3:
                pattern = "stream"
                if i == 1:
                    hobj0.pattern_type = "begin-stream"
                # below is added because we break loop on last item early ([i+1] index not possible)
                if i == len(self.hit_objects) - 2 and self.hit_objects[i+1].object_type != "spinner":
                    if pred_right_four < 3:
                        hobj2.pattern_type = "end-stream"
                    elif pred_right_two < 3 or end1 + one_one < hobj2.time:
                        hobj2.pattern_type = "jump"
                    else:
                        hobj2.pattern_type = "irregular"
                # if we have for example a jump before hobj0
                if hobj0.pattern_type == "irregular":
                    hobj0.pattern_type = "begin-stream"
                # if the next hit object is more than a 1/4 away then this signals end of stream
                if pred_right_four >= 3:
                    pattern = "end-stream"

            elif "slider" in hobj1.object_type and hobj0.object_type == "circle" and pred_left_four < 3 and hobj0.pattern_type == "stream":
                pattern = "end-stream"
                if i == len(self.hit_objects) - 2 and self.hit_objects[i+1].object_type != "spinner":
                    if pred_right_four < 3:
                        hobj2.pattern_type = "irregular"
                    else:
                        hobj2.pattern_type = "jump"
            else:
                pattern = "irregular"
                if i == len(self.hit_objects) - 2 and not hobj2.pattern_type:
                    hobj2.pattern_type = "irregular"
                elif i == len(self.hit_objects) - 2 and self.hit_objects[i+1].object_type != "spinner":
                    if pred_right_two < 3 or end1 + one_one < hobj2.time:
                        hobj2.pattern_type = "jump"

            hobj1.pattern_type = pattern

    def get_pattern_sections(self) -> list[list[HitObject]]:
        '''
        Creates a list of lists. Each inner list corresponds to a either a `jump` section
        a `stream` section, `irregular` rhythm section, or a `spinner`. Call after `self.get_patterns`
        because it relies on the `pattern_type` property of each `HitObject` which is set when `self.get_patterns`
        is called.
        '''
        all_segments = []
        if not len(self.hit_objects):
            return all_segments
        curr_seg = []
        tmp = self.hit_objects[0].pattern_type
        val = tmp
        for h in self.hit_objects:
            val = h.pattern_type
            if val != tmp:
                if (val == "stream" or val == "end-stream") and tmp == "begin-stream":
                    curr_seg.append(h)
                    if val == "end-stream":
                        all_segments.append(curr_seg)
                        curr_seg = []
                    continue
                elif len(curr_seg):
                    all_segments.append(curr_seg)
                curr_seg = [h]
                tmp = h.pattern_type
                val = h.pattern_type
            else:
                curr_seg.append(h)
        if len(curr_seg):
            all_segments.append(curr_seg)
        return all_segments


class StreamStats:
    def __init__(self, avg_spacing, density):
        self.avg_spacing = avg_spacing
        self.density = density


class RhythmStats:
    def __init__(self, num_jump_secs, num_irr_secs, num_stream_secs, num_burst_secs, num_jump_objs, num_irr_objs, num_stream_objs, num_burst_objs):
        self.num_jump_secs = num_jump_secs
        self.num_irr_secs = num_irr_secs
        self.num_stream_secs = num_stream_secs
        self.num_burst_secs = num_burst_secs

        self.num_jump_objs = num_jump_objs
        self.num_irr_objs = num_irr_objs
        self.num_stream_objs = num_stream_objs
        self.num_burst_objs = num_burst_objs

# ------------------------------ END OF BASIC CLASS DEFINITIONS ----------------------#######################


def calc_rhythm_stats(all_segments: list[list[HitObject]]):
    num_jump_secs = 0
    num_irr_secs = 0
    num_stream_secs = 0
    num_burst_secs = 0

    num_jump_objs = 0
    num_irr_objs = 0
    num_stream_objs = 0
    num_burst_objs = 0

    for sec in all_segments:
        if len(set([a.pattern_type for a in sec])) == 3:
            if len(sec) <= 5:
                num_burst_secs += 1
                num_burst_objs += len(sec)
            else:
                num_stream_secs += 1
                num_stream_objs += len(sec)

        elif "irregular" in set([a.pattern_type for a in sec]):
            num_irr_secs += 1
            num_irr_objs += len(sec)
        elif "jump" in set([a.pattern_type for a in sec]):
            num_jump_secs += 1
            num_jump_objs += len(sec)

    return RhythmStats(num_jump_secs, num_irr_secs, num_stream_secs, num_burst_secs, num_jump_objs, num_irr_objs, num_stream_objs, num_burst_objs)


def calc_stream_stats(segments: list[list[HitObject]], cs: float) -> StreamStats:
    if not len(segments):
        return StreamStats(0, 0)
    r = circle_radius_from_cs(cs)
    spacing = []
    denom = 0
    total = 0
    for seg in segments:
        total += len(seg)
        if len(set([a.pattern_type for a in seg])) == 3:
            seg_spacing = []
            denom += len(seg)
            for i in range(1, len(seg)):
                xprev = seg[i-1].x
                yprev = seg[i-1].y
                x = seg[i].x
                y = seg[i].y
                seg_spacing.append(
                    math.sqrt((xprev - x)**2 + (yprev - y)**2) / r)
            spacing.append(sum(seg_spacing))

    return StreamStats(sum(spacing) / (denom if denom != 0 else 1), denom / (total if total != 0 else 1))
################### ---------------------- END OF STAT CALCULATORS -------------------###############################


def create_stats_entry(fpath: str, lazer: bool = False):
    try:
        parsed_bm = Beatmap(fpath)
        parse_res = parsed_bm.parse()
        if parse_res == "Mode is not osu!":
            raise Exception(parse_res)
        else:
            parsed_bm.get_patterns()
            all_segments = parsed_bm.get_pattern_sections()
            ss = calc_stream_stats(all_segments, parsed_bm.cs)
            rstats = calc_rhythm_stats(all_segments)
            # calculate star rating and 100% pp
            rosu_bm = rosu_pp_py.Beatmap(path=fpath)
            pp_100 = 0
            pp_95 = 0
            max_combo = 0
            if not rosu_bm.is_suspicious():
                perf = rosu_pp_py.Performance(accuracy=100, lazer=lazer)
                rosu_result = perf.calculate(rosu_bm)
                pp_100 = rosu_result.pp
                pp_95 = rosu_pp_py.Performance(
                    accuracy=95, lazer=lazer).calculate(rosu_bm).pp
                parsed_bm.star_rating = rosu_result.difficulty.stars
                max_combo = rosu_result.difficulty.max_combo
            else:
                raise Exception("Suspicious map according to rosu.")
            # end
            # if ID does not exist
            url = f"https://osu.ppy.sh/beatmapsets/{parsed_bm.beatmapsetID}#osu/{parsed_bm.beatmapID}"
            bg_url = f"https://assets.ppy.sh/beatmaps/{parsed_bm.beatmapsetID}/covers/cover.jpg"
            # # check if ids are valid
            invalid_id = False
            if isinstance(parsed_bm.beatmapID, int):
                if parsed_bm.beatmapID < 0:
                    invalid_id = True
            else:
                invalid_id = True
            if isinstance(parsed_bm.beatmapsetID, int):
                if parsed_bm.beatmapsetID < 0:
                    invalid_id = True
            else:
                invalid_id = True
            # # end check
            # # modify the urls if needed from check
            if invalid_id:
                enc = quote(
                    f"title=\'\'\'{parsed_bm.title}\'\'\' creator=\'\'\'{parsed_bm.creator}\'\'\' artist=\'\'\'{parsed_bm.artist}\'\'\'")
                url = f"https://osu.ppy.sh/beatmapsets?q={enc}"
                bg_url = "assets/bg_placeholder.png"
            # end
            avg_irr_length = rstats.num_irr_objs / \
                rstats.num_irr_secs if rstats.num_irr_secs > 0 else 0
            avg_num_jumps = rstats.num_jump_objs / \
                rstats.num_jump_secs if rstats.num_jump_secs > 0 else 0
            avg_burst_length = rstats.num_burst_objs / \
                rstats.num_burst_secs if rstats.num_burst_secs > 0 else 0
            overall_irr = 100 * (rstats.num_irr_objs / len(parsed_bm.hit_objects) if len(
                parsed_bm.hit_objects) > 0 else 0)

            is_regular = True if overall_irr <= 7.27 else False

            is_jump = False
            if is_regular and avg_num_jumps > 10 and rstats.num_stream_secs == 0 and rstats.num_jump_secs > rstats.num_burst_secs:
                is_jump = True

            is_stream = False
            if is_regular and rstats.num_stream_secs > 0 and ss.density >= 0.25 and ss.avg_spacing <= 0.727:
                is_stream = True

            return {
                "avg_num_jumps": avg_num_jumps,
                "avg_stream_length": rstats.num_stream_objs / rstats.num_stream_secs if rstats.num_stream_secs > 0 else 0,
                "avg_burst_length": avg_burst_length,
                "avg_irr_length": avg_irr_length,
                "overall_irr_percent": overall_irr,
                "num_jump_secs": rstats.num_jump_secs,
                "num_stream_secs": rstats.num_stream_secs,
                "num_burst_secs": rstats.num_burst_secs,
                "num_irr_secs": rstats.num_irr_secs,
                "is_regular": is_regular,
                "is_jump": is_jump,
                "is_stream": is_stream,
                "stream-density": ss.density,
                "stream-spacing": ss.avg_spacing,
                "ar": parsed_bm.AR,
                "bpm": parsed_bm.dominant_bpm,
                "id": parsed_bm.beatmapID,
                "beatmapset_id": parsed_bm.beatmapsetID,
                "title": parsed_bm.title,
                "artist": parsed_bm.artist,
                "creator": parsed_bm.creator,
                "star_rating": parsed_bm.star_rating,
                "pp_100": pp_100,
                "pp_95": pp_95,
                "tags": parsed_bm.tags,
                "max_combo": max_combo,
                "bg_url": bg_url,
                "url": url,
                "version": parsed_bm.version,
                "_fpath": os.path.join(os.path.basename(os.path.dirname(fpath)), os.path.basename(fpath))
            }
    except Exception as e:
        return f"ERROR: {e} -- {fpath}"
