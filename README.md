**Link to the website:** [osu-scout](https://wakasagihime-dev.github.io/osu_scout/)

**Hello world!**

![website preview](./assets/site-preview.png)
![website preview](./assets/preview-2.png)

**What is this? Why did you make it?**  
This website is a search tool that should hopefully allow you to easily find the _type_ of maps that you are looking for. Search is based on numerical and textual stats that I calculated and collected for the (almost) 51k maps I already have on lazer and for the newest ranked maps that show up in the [osu! beatmap listing](https://osu.ppy.sh/beatmapsets). It is not intended to be a complete database of all ranked maps, only maps I had on my PC and the newly ranked. Therefore, the database will be partially purged to keep its size constant while having constant updates with new maps if it grows too large for me to maintain.

The aim stat is the one I care about the most. I created this simple stat by rewarding jump (1/2 rhythm) sections of songs and penalizing irregular rhythm sections and streams (anything not 1/2 gets penalty). Geometry/circle position is not taken into account which has its own implications and "bugs" but they are not significant enough for me to worry about. You could also use this as a stamina trainer because stream density and stream spacing are also calculated for each map. If you have ever used [sombrax](https://ost.sombrax79.org/) you'll know what these stats mean.

**Text search example (text-type query):** `creator="akitoshi" artist="kawada mimi fripside" tags="japanese anime"`

**Explanation:** Well, this is really simple. Please keep in mind to hit enter for the search results to come. The only thing I have to mention is that I did not put too much effort in the code because I am not too bothered. So you will get maps with songs sung by kawada, mimi, and fripside (for those who don't get the issue with this kawada mimi is one artist, not two separate artists kawada and mimi). Another example, if you write:

`artist="imperial circus dead decadance"`

you will get maps of songs sung by ICDD and also sung by this band for example: "Girls Dead Monster STARRING LiSA" because both contain the word dead. Not a bug, a feature.  
**IMPORTANT:** you must include the quotes ("") when doing text based search!  
**Note:** you can of course combine this with number-type stat search query. Number stats are explained below.

**Number stats search example (number-type query):** `aim=75 star_rating=4-4.5 bpm=150-180 ar=9`

**Explanation:** `aim=75` means that you will get maps scoring more than 75% on aim stat (a stat that I made to calculate how likely the map is to be a comfy aim map). Interpret it as a percentage (0% burst heavy map to 100% is aim centered map). This value can exceed 100. I know percentages do not but it was my decision to reward certain parts of maps to distinguish them as "aim heavy", think of the value on top of the 100% as a bonus to the stat. Keep in mind you can either do something like `aim=82` or `aim=85-96` which defines minimum or both minimum and maximum respectively. You cannot define a maximum alone! This goes for all number-type stats (see list of all of them below in usage)!

`star_rating=4-4.5` means that you will get maps that are greater than or equal to 4\* in difficulty and less or equal to 4.5\* in difficulty.

`bpm=150-180` you can take a guess. Maps between 150 BPM and 180 BPM.

`ar=9` means that the minimum approach rate in the maps you get will be 9.

In general you can provide either a single value or a hyphen separated range of min and max values (inclusive).

**Usage:** The following search keywords are to be used:

- aim
- stream-density
- stream-spacing
- ar
- bpm
- star_rating
- pp_100
- pp_95
- max_combo

**See all beatmaps:** To see the current list of all beatmaps simply completely empty the search field (backspace) and hit `Enter`.

**PS:** This website is meant to host only the [newest mapsets](https://osu.ppy.sh/beatmapsets). I run a script weekly to update this website so keep an eye out. Every month the entire database will be purged and I start updating weekly again from scratch.

**Thank you for reading.** If you found this useful and want to say thanks or want to suggest something or want to criticize something [then hit me up on osu!](https://osu.ppy.sh/users/34763802)
