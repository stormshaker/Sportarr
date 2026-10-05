using FluentAssertions;
using Sportarr.Api.Models;
using Sportarr.Api.Services;

namespace Sportarr.Api.Tests.Services;

/// <summary>
/// Team leagues outside ReleaseMatchScorer's IsTeamSport list get no team
/// scoring, so a different game from the same league and day used to score as
/// highly as the right one and could be grabbed automatically. Validation only
/// rejects softly when neither team is named, and automatic search drops hard
/// rejections alone.
/// </summary>
public class UnlistedTeamLeagueScoringTests
{
    private static readonly ReleaseMatchScorer Scorer = new();

    private static Event TeamEvent(string league, string sport, string home, string away, DateTime date, string round) => new()
    {
        Title = $"{home} vs {away}",
        Sport = sport,
        Season = date.Year.ToString(),
        Round = round,
        EventDate = DateTime.SpecifyKind(date, DateTimeKind.Utc),
        BroadcastDate = date,
        BroadcastDateVerified = true,
        HomeTeamId = 1,
        AwayTeamId = 2,
        HomeTeamName = home,
        AwayTeamName = away,
        League = new League { Name = league, Sport = sport },
    };

    private static Event Championship() => TeamEvent(
        "English League Championship", "Soccer", "Stoke City", "Norwich City", new DateTime(2026, 9, 13), "6");

    private static Event Nrl() => TeamEvent(
        "NRL", "Rugby League", "Canberra Raiders", "South Sydney Rabbitohs", new DateTime(2026, 7, 19), "20");

    [Theory]
    [InlineData("EFL.Championship.2026.09.13.Birmingham.City.vs.Southampton.1080p.WEB.h264-GRP")]
    [InlineData("EFL.Championship.2026.09.13.Sheffield.Wednesday.vs.Millwall.1080p.WEB.h264-GRP")]
    public void SameDayGameBetweenOtherClubsCannotAutoGrab(string title)
    {
        Scorer.CalculateMatchScore(title, Championship())
            .Should().BeLessThan(ReleaseMatchScorer.AutoGrabMatchScore);
    }

    [Theory]
    [InlineData("NRL.2026.Round.20.Raiders.v.Storm.1080p.WEB.h264-GRP")]
    [InlineData("NRL.2026.Round.20.Broncos.v.Storm.1080p.WEB.h264-GRP")]
    public void SameRoundGameBetweenOtherClubsCannotAutoGrab(string title)
    {
        Scorer.CalculateMatchScore(title, Nrl())
            .Should().BeLessThan(ReleaseMatchScorer.AutoGrabMatchScore);
    }

    [Theory]
    [InlineData("EFL.Championship.2026.09.13.Stoke.City.vs.Norwich.City.1080p.WEB.h264-GRP")]
    [InlineData("EFL.Championship.2026.09.13.Stoke.vs.Norwich.1080p.WEB.h264-GRP")]
    public void TheRightChampionshipGameStillAutoGrabs(string title)
    {
        Scorer.CalculateMatchScore(title, Championship())
            .Should().BeGreaterThanOrEqualTo(ReleaseMatchScorer.AutoGrabMatchScore);
    }

    [Theory]
    [InlineData("NRL.2026.Round.20.Raiders.v.Rabbitohs.1080p.WEB.h264-GRP")]
    [InlineData("NRL.2026.Round.20.Canberra.Raiders.vs.South.Sydney.Rabbitohs.1080p.WEB.h264-GRP")]
    public void TheRightNrlGameStillAutoGrabs(string title)
    {
        Scorer.CalculateMatchScore(title, Nrl())
            .Should().BeGreaterThanOrEqualTo(ReleaseMatchScorer.AutoGrabMatchScore);
    }

    [Fact]
    public void UserAliasesIdentifyTheTeams()
    {
        var evt = TeamEvent("AFL Womens", "Australian Football",
            "St Kilda Saints Women", "Carlton Blues Women", new DateTime(2026, 8, 9), "1");
        evt.HomeTeam = new Team { Name = evt.HomeTeamName!, Sport = evt.Sport, UserAliases = "St Kilda" };
        evt.AwayTeam = new Team { Name = evt.AwayTeamName!, Sport = evt.Sport, UserAliases = "Carlton" };

        Scorer.CalculateMatchScore("AFLW 2026.08.09 Round 1 St Kilda V Carlton 1080p WEB-DL H264", evt)
            .Should().BeGreaterThanOrEqualTo(ReleaseMatchScorer.AutoGrabMatchScore);
    }
}
